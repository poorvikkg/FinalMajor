/**
 * suspectRelay.service.ts
 *
 * Core business logic for the CCTV Suspect Relay & Dynamic Chase Network.
 *
 * Chase Algorithm:
 *   1. Suspect detected on Camera A → activate ring of cameras within radiusMeters (FRONTIER)
 *   2. Suspect confirmed on Camera B (one of the frontier cameras):
 *      a. Calculate bearing A → B
 *      b. PRUNE (stop streams) any frontier cameras >90° off bearing
 *      c. ADVANCE (start streams) for cameras adjacent to B = new FRONTIER
 *   3. Repeat until alert resolved or expires
 *
 * Camera States during a chase:
 *   FRONTIER  → streaming live, watching for suspect     (frontierCameraIds)
 *   CONFIRMED → sighting confirmed here (relay hop)      (confirmedCameraIds)
 *   PRUNED    → stream stopped, wrong direction          (prunedCameraIds)
 *   ALERTED   → received notification (superset)         (alertedCameraIds)
 */

import { Types } from 'mongoose';
import { Camera } from '../models/Camera';
import { SuspectAlert, ISuspectAlert, IRelayHop } from '../models/SuspectAlert';
import { Complaint } from '../models/Complaint';
import { UnknownPerson } from '../models/UnknownPerson';
import * as cameraService from './camera.service';
import {
  emitSuspectRelayAlert,
  emitSuspectRelayUpdated,
  emitSuspectRelayResolved,
} from '../socket/socket';
import { logger } from '../config/logger';

/** Default relay radius in meters */
const DEFAULT_RELAY_RADIUS = 1000;

/** Auto-expire alerts after 2 hours of inactivity */
const ALERT_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Bearing cutoff: frontier cameras more than this many degrees off the
 * direction of movement are pruned (stopped). 90° means only the rear
 * half of the ring is pruned; increase to be more aggressive.
 */
const PRUNE_BEARING_CUTOFF_DEG = 90;

// ─────────────────────────────────────────────────────────────────────────────
// Geometry helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Compass bearing in degrees [0, 360) from point 1 → point 2 */
function computeBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Smallest angular difference between two bearings [0, 180] */
function bearingDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// ─────────────────────────────────────────────────────────────────────────────
// Counter for auto-generating alertIds
// ─────────────────────────────────────────────────────────────────────────────
async function generateAlertId(): Promise<string> {
  const count = await SuspectAlert.countDocuments();
  return `ALERT-${String(count + 1).padStart(6, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Find cameras geospatially near a point, excluding specific camera IDs
// ─────────────────────────────────────────────────────────────────────────────
export async function getNearbyCameras(
  lat: number,
  lng: number,
  radiusMeters: number,
  excludeIds: string[] = []
) {
  const excludeObjectIds = excludeIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const query: any = {
    isActive: true,
    status: { $ne: 'maintenance' },
    'location.locationGeoJson': {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radiusMeters,
      },
    },
  };

  if (excludeObjectIds.length > 0) {
    query._id = { $nin: excludeObjectIds };
  }

  return Camera.find(query)
    .select('_id name location status rtspUrl activeAlerts')
    .lean();
}

// ─────────────────────────────────────────────────────────────────────────────
// START FRONTIER CAMERAS — activate streams for the new ring of cameras
// ─────────────────────────────────────────────────────────────────────────────
async function startFrontierCameras(
  alert: ISuspectAlert,
  cameras: any[]
): Promise<Types.ObjectId[]> {
  const startedIds: Types.ObjectId[] = [];

  // Start all cameras concurrently
  await Promise.allSettled(
    cameras.map(async (cam) => {
      try {
        // Only start cameras that have an RTSP URL configured
        if (!cam.rtspUrl) {
          logger.debug({ camId: cam._id }, '[ChaseRelay] Skipping cam without RTSP URL');
          return;
        }
        await cameraService.startCamera(cam._id.toString(), 'target');
        startedIds.push(cam._id as Types.ObjectId);
        logger.info(
          { camId: cam._id, name: cam.name, alertId: alert.alertId },
          '[ChaseRelay] Frontier camera STARTED'
        );
      } catch (err: any) {
        logger.warn(
          { camId: cam._id, err: err.message },
          '[ChaseRelay] Failed to start frontier camera'
        );
      }
    })
  );

  return startedIds;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUNE FRONTIER CAMERAS — stop streams for cameras in the wrong direction
// ─────────────────────────────────────────────────────────────────────────────
async function pruneFrontierCameras(
  alert: ISuspectAlert,
  prevLat: number,
  prevLng: number,
  confirmedLat: number,
  confirmedLng: number
): Promise<Types.ObjectId[]> {
  if (alert.frontierCameraIds.length === 0) return [];

  // Movement bearing: direction the suspect is travelling
  const movementBearing = computeBearing(prevLat, prevLng, confirmedLat, confirmedLng);

  // Fetch current frontier cameras to get their locations
  const frontierCams = await Camera.find({
    _id: { $in: alert.frontierCameraIds },
  })
    .select('_id name location rtspUrl')
    .lean();

  const prunedIds: Types.ObjectId[] = [];

  await Promise.allSettled(
    frontierCams.map(async (cam) => {
      const camLoc = cam.location as any;
      const camLat = camLoc?.latitude;
      const camLng = camLoc?.longitude;
      if (!camLat || !camLng) return;

      // Bearing from confirmed camera to this frontier camera
      const camBearing = computeBearing(confirmedLat, confirmedLng, camLat, camLng);
      const diff = bearingDiff(movementBearing, camBearing);

      if (diff > PRUNE_BEARING_CUTOFF_DEG) {
        // This camera is behind / off-path — stop it
        try {
          if (cam.rtspUrl) {
            await cameraService.stopCamera(cam._id.toString());
          }
          prunedIds.push(cam._id as Types.ObjectId);
          logger.info(
            { camId: cam._id, name: cam.name, bearingDiff: diff.toFixed(1) },
            '[ChaseRelay] Frontier camera PRUNED (off bearing)'
          );
        } catch (err: any) {
          logger.warn(
            { camId: cam._id, err: err.message },
            '[ChaseRelay] Failed to stop pruned camera'
          );
        }
      }
    })
  );

  return prunedIds;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCE RELAY FRONTIER — full hop cycle:
//   1. Prune off-bearing cameras from previous frontier
//   2. Start new ring of cameras around the newly confirmed camera
// ─────────────────────────────────────────────────────────────────────────────
async function advanceRelayFrontier(
  alert: ISuspectAlert,
  newHopCameraId: string,
  newLat: number,
  newLng: number
): Promise<void> {
  const alertId = alert.alertId;
  const radiusMeters = alert.radiusMeters || DEFAULT_RELAY_RADIUS;

  // ── A. Compute previous hop location for bearing calculation ──────────────
  const chain = alert.relayChain;
  let prevLat = newLat;
  let prevLng = newLng;

  if (chain.length >= 2) {
    // Use the second-to-last hop as the "from" point
    const prevHop = chain[chain.length - 2];
    prevLat = prevHop.latitude;
    prevLng = prevHop.longitude;
  } else if (chain.length === 1) {
    prevLat = chain[0].latitude;
    prevLng = chain[0].longitude;
  }

  // ── B. Prune off-bearing frontier cameras ─────────────────────────────────
  const prunedIds = await pruneFrontierCameras(alert, prevLat, prevLng, newLat, newLng);

  // ── C. Find new ring of cameras around confirmed hop ──────────────────────
  // Exclude: already confirmed cameras + the new hop camera itself
  const alreadyUsedIds = [
    ...alert.confirmedCameraIds.map((id) => id.toString()),
    newHopCameraId,
  ];

  const newFrontierCams = await getNearbyCameras(newLat, newLng, radiusMeters, alreadyUsedIds);

  // ── D. Start new frontier cameras ─────────────────────────────────────────
  const newStartedIds = await startFrontierCameras(alert, newFrontierCams);

  // ── E. Update alert document atomically ──────────────────────────────────
  const prunedObjectIds = prunedIds;
  const remainingFrontierIds = alert.frontierCameraIds.filter(
    (id) => !prunedObjectIds.some((pid) => pid.equals(id))
  );

  await SuspectAlert.updateOne(
    { _id: alert._id },
    {
      $set: {
        // New frontier = (old frontier minus pruned) + newly started
        frontierCameraIds: [...remainingFrontierIds, ...newStartedIds],
      },
      $addToSet: {
        alertedCameraIds: { $each: newStartedIds },
        prunedCameraIds: { $each: prunedObjectIds },
      },
      // Remove pruned from frontier
      $pull: {},
    }
  );

  logger.info(
    {
      alertId,
      newFrontierCount: newStartedIds.length,
      prunedCount: prunedIds.length,
    },
    '[ChaseRelay] Relay frontier advanced'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Primary entry point: called when AI service detects a suspect on a camera
// ─────────────────────────────────────────────────────────────────────────────
export async function triggerSuspectRelay(params: {
  cameraId: string;
  suspectType: 'KNOWN' | 'UNKNOWN';
  personId?: string;
  unknownPersonId?: string;
  similarity: number;
  snapshotObjectKey?: string;
  radiusMeters?: number;
}): Promise<ISuspectAlert | null> {
  const {
    cameraId,
    suspectType,
    personId,
    unknownPersonId,
    similarity,
    snapshotObjectKey,
    radiusMeters = DEFAULT_RELAY_RADIUS,
  } = params;

  // ── 1. Fetch the detecting camera ──────────────────────────────────────────
  const detectingCamera = await Camera.findById(cameraId).lean();
  if (!detectingCamera) {
    logger.warn({ cameraId }, '[ChaseRelay] Detecting camera not found');
    return null;
  }

  const camLoc = typeof detectingCamera.location === 'object' ? detectingCamera.location as any : null;
  const lat = camLoc?.latitude ?? 0;
  const lng = camLoc?.longitude ?? 0;
  const locationName = camLoc?.name ?? 'Unknown Location';

  // ── 2. Resolve suspect display label ──────────────────────────────────────
  let suspectLabel = 'Unknown Suspect';
  if (suspectType === 'KNOWN' && personId) {
    const complaint = await Complaint.findById(personId).select('missingPersonName complaintId').lean();
    suspectLabel = complaint?.missingPersonName || `Case ${complaint?.complaintId}` || 'Known Person';
  } else if (suspectType === 'UNKNOWN' && unknownPersonId) {
    const unknown = await UnknownPerson.findById(unknownPersonId).select('unknownId').lean();
    suspectLabel = unknown?.unknownId || 'Unknown Person';
  }

  // ── 3. Check if an ACTIVE alert already exists for this suspect ────────────
  const suspectQuery: any = { status: 'ACTIVE' };
  if (suspectType === 'KNOWN' && personId) {
    suspectQuery.personId = new Types.ObjectId(personId);
  } else if (suspectType === 'UNKNOWN' && unknownPersonId) {
    suspectQuery.unknownPersonId = new Types.ObjectId(unknownPersonId);
  }

  let alert = await SuspectAlert.findOne(suspectQuery);

  // ── 4. Build the relay hop ─────────────────────────────────────────────────
  const hopIndex = alert ? alert.relayChain.length : 0;
  const newHop: IRelayHop = {
    cameraId: new Types.ObjectId(cameraId),
    cameraName: detectingCamera.name,
    locationName,
    latitude: lat,
    longitude: lng,
    detectedAt: new Date(),
    similarity,
    snapshotObjectKey,
    hopIndex,
  };

  // ── 5. Create or update the SuspectAlert ──────────────────────────────────
  if (!alert) {
    // ── FIRST DETECTION: create alert + start initial frontier ring ──────────
    const alertId = await generateAlertId();

    // Find initial ring of cameras around detecting camera
    const initialFrontierCams = await getNearbyCameras(lat, lng, radiusMeters, [cameraId]);

    alert = await SuspectAlert.create({
      alertId,
      suspectType,
      personId: personId ? new Types.ObjectId(personId) : undefined,
      unknownPersonId: unknownPersonId ? new Types.ObjectId(unknownPersonId) : undefined,
      suspectLabel,
      status: 'ACTIVE',
      originCameraId: new Types.ObjectId(cameraId),
      lastDetectedCameraId: new Types.ObjectId(cameraId),
      alertedCameraIds: [],
      confirmedCameraIds: [new Types.ObjectId(cameraId)],
      frontierCameraIds: [],
      prunedCameraIds: [],
      relayChain: [newHop],
      radiusMeters,
      snapshotObjectKey,
      triggerSimilarity: similarity,
      expiresAt: new Date(Date.now() + ALERT_TTL_MS),
    });

    logger.info({ alertId: alert.alertId, suspectLabel }, '[ChaseRelay] New alert created — starting initial frontier');

    // Start streams for all nearby cameras in parallel
    const startedIds = await startFrontierCameras(alert, initialFrontierCams);

    // Update alert with frontier IDs
    if (startedIds.length > 0) {
      await SuspectAlert.updateOne(
        { _id: alert._id },
        {
          $set: { frontierCameraIds: startedIds },
          $addToSet: { alertedCameraIds: { $each: startedIds } },
        }
      );
    }

    logger.info(
      { alertId: alert.alertId, frontierCount: startedIds.length },
      '[ChaseRelay] Initial frontier activated'
    );
  } else {
    // ── HOP CONFIRMED: suspect seen at a frontier camera ─────────────────────
    // Update alert: push new hop, move this camera from frontier → confirmed
    await SuspectAlert.updateOne(
      { _id: alert._id },
      {
        $push: {
          relayChain: newHop,
          confirmedCameraIds: new Types.ObjectId(cameraId),
        },
        $set: {
          lastDetectedCameraId: new Types.ObjectId(cameraId),
          expiresAt: new Date(Date.now() + ALERT_TTL_MS),
          snapshotObjectKey: snapshotObjectKey || alert.snapshotObjectKey,
        },
        $pull: {
          alertedCameraIds: new Types.ObjectId(cameraId),
          frontierCameraIds: new Types.ObjectId(cameraId),
        },
      }
    );

    // Re-fetch with updated relayChain for bearing computation
    const updatedAlert = await SuspectAlert.findById(alert._id).lean() as unknown as ISuspectAlert;

    if (updatedAlert) {
      // Advance the frontier: prune dead-ends + start new ring
      await advanceRelayFrontier(updatedAlert, cameraId, lat, lng);
    }

    alert = await SuspectAlert.findById(alert._id).lean() as any;
    logger.info({ alertId: alert!.alertId, hop: hopIndex }, '[ChaseRelay] Relay hop confirmed — frontier advanced');
  }

  if (!alert) return null;

  // ── 6. Emit real-time Socket.IO events ────────────────────────────────────
  const freshAlert = await SuspectAlert.findById(alert._id)
    .populate('originCameraId', 'name location')
    .populate('lastDetectedCameraId', 'name location')
    .populate('alertedCameraIds', 'name location status')
    .populate('confirmedCameraIds', 'name location')
    .populate('frontierCameraIds', 'name location status')
    .populate('prunedCameraIds', 'name location')
    .lean();

  if (hopIndex === 0) {
    emitSuspectRelayAlert({
      alertId: freshAlert!.alertId,
      suspectType: freshAlert!.suspectType,
      suspectLabel: freshAlert!.suspectLabel,
      snapshotObjectKey: freshAlert!.snapshotObjectKey,
      triggerSimilarity: freshAlert!.triggerSimilarity,
      originCamera: freshAlert!.originCameraId,
      alertedCameras: freshAlert!.alertedCameraIds,
      frontierCameras: (freshAlert as any).frontierCameraIds,
      relayChain: freshAlert!.relayChain,
      createdAt: freshAlert!.createdAt,
    });
  } else {
    emitSuspectRelayUpdated({
      alertId: freshAlert!.alertId,
      suspectLabel: freshAlert!.suspectLabel,
      lastDetectedCamera: freshAlert!.lastDetectedCameraId,
      alertedCameras: freshAlert!.alertedCameraIds,
      confirmedCameras: freshAlert!.confirmedCameraIds,
      frontierCameras: (freshAlert as any).frontierCameraIds,
      prunedCameras: (freshAlert as any).prunedCameraIds,
      relayChain: freshAlert!.relayChain,
      updatedAt: new Date(),
    });
  }

  return freshAlert as any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolve an alert — stops ALL frontier camera streams, cleans up state
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveAlert(alertId: string, reason = 'Manual resolution') {
  const alert = await SuspectAlert.findOne({ alertId });
  if (!alert) return null;
  if (alert.status !== 'ACTIVE') return alert;

  // Stop all currently streaming frontier cameras
  if (alert.frontierCameraIds.length > 0) {
    await Promise.allSettled(
      alert.frontierCameraIds.map(async (camId) => {
        try {
          await cameraService.stopCamera(camId.toString());
          logger.info({ camId: camId.toString(), alertId }, '[ChaseRelay] Frontier camera stopped on resolve');
        } catch (err: any) {
          logger.warn({ camId: camId.toString(), err: err.message }, '[ChaseRelay] Failed to stop frontier camera on resolve');
        }
      })
    );
  }

  // Clear activeAlerts from all cameras in this chain
  const allCameraIds = [
    ...alert.alertedCameraIds,
    ...alert.confirmedCameraIds,
    ...alert.frontierCameraIds,
  ];
  await Camera.updateMany(
    { _id: { $in: allCameraIds } },
    { $pull: { activeAlerts: alert._id } }
  );

  const resolved = await SuspectAlert.findOneAndUpdate(
    { alertId },
    {
      $set: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedReason: reason,
        frontierCameraIds: [],
      },
    },
    { new: true }
  ).lean();

  emitSuspectRelayResolved({
    alertId,
    reason,
    resolvedAt: new Date(),
  });

  logger.info({ alertId, reason }, '[ChaseRelay] Alert resolved — all frontier cameras stopped');
  return resolved;
}

// ─────────────────────────────────────────────────────────────────────────────
// Expire stale alerts (called on a 5-minute interval from server startup)
// ─────────────────────────────────────────────────────────────────────────────
export async function expireStaleAlerts() {
  const stale = await SuspectAlert.find({
    status: 'ACTIVE',
    expiresAt: { $lt: new Date() },
  }).lean();

  for (const alert of stale) {
    await resolveAlert(alert.alertId, 'Auto-expired due to inactivity');
    logger.info({ alertId: alert.alertId }, '[ChaseRelay] Alert auto-expired');
  }

  return stale.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// List alerts with pagination and optional status filter
// ─────────────────────────────────────────────────────────────────────────────
export async function getAlerts(page = 1, limit = 20, status?: string) {
  const query: any = {};
  if (status) query.status = status;

  const [alerts, total] = await Promise.all([
    SuspectAlert.find(query)
      .populate('originCameraId', 'name location')
      .populate('lastDetectedCameraId', 'name location')
      .populate('alertedCameraIds', 'name location status')
      .populate('frontierCameraIds', 'name location status')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SuspectAlert.countDocuments(query),
  ]);

  return { alerts, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// Get single alert with full relay chain detail
// ─────────────────────────────────────────────────────────────────────────────
export async function getAlertById(alertId: string) {
  return SuspectAlert.findOne({ alertId })
    .populate('personId', 'complaintId missingPersonName attachments status')
    .populate('unknownPersonId', 'unknownId status representativeSnapshot')
    .populate('originCameraId', 'name location status')
    .populate('lastDetectedCameraId', 'name location status')
    .populate('alertedCameraIds', 'name location status')
    .populate('confirmedCameraIds', 'name location status')
    .populate('frontierCameraIds', 'name location status')
    .populate('prunedCameraIds', 'name location status')
    .lean();
}

// ─────────────────────────────────────────────────────────────────────────────
// Get active alerts for a specific camera
// ─────────────────────────────────────────────────────────────────────────────
export async function getAlertsForCamera(cameraId: string) {
  return SuspectAlert.find({
    status: 'ACTIVE',
    $or: [
      { alertedCameraIds: new Types.ObjectId(cameraId) },
      { confirmedCameraIds: new Types.ObjectId(cameraId) },
      { frontierCameraIds: new Types.ObjectId(cameraId) },
    ],
  })
    .select('alertId suspectLabel suspectType snapshotObjectKey triggerSimilarity createdAt')
    .lean();
}
