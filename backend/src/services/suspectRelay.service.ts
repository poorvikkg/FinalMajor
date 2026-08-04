/**
 * suspectRelay.service.ts
 *
 * Core business logic for the CCTV Suspect Relay & Chase Network.
 *
 * When a suspect is detected on any camera, this service:
 *   1. Creates or updates a SuspectAlert document
 *   2. Queries MongoDB for cameras within radiusMeters using $nearSphere
 *   3. Marks those cameras as ALERTED (activeAlerts field)
 *   4. Emits Socket.IO events so the live chase map updates in real-time
 *   5. Auto-expires stale alerts every 5 minutes
 */

import { Types } from 'mongoose';
import { Camera } from '../models/Camera';
import { SuspectAlert, ISuspectAlert, IRelayHop } from '../models/SuspectAlert';
import { Complaint } from '../models/Complaint';
import { UnknownPerson } from '../models/UnknownPerson';
import {
  emitSuspectRelayAlert,
  emitSuspectRelayUpdated,
  emitSuspectRelayResolved,
} from '../socket/socket';
import { logger } from '../config/logger';

/** Default relay radius in meters — finds cameras within ~1 city block */
const DEFAULT_RELAY_RADIUS = 1000;

/** Auto-expire alerts after 2 hours of inactivity */
const ALERT_TTL_MS = 2 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Counter for auto-generating alertIds
// ─────────────────────────────────────────────────────────────────────────────
async function generateAlertId(): Promise<string> {
  const count = await SuspectAlert.countDocuments();
  return `ALERT-${String(count + 1).padStart(6, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Find cameras geospatially near a point, excluding a specific camera
// ─────────────────────────────────────────────────────────────────────────────
export async function getNearbyCameras(
  lat: number,
  lng: number,
  radiusMeters: number,
  excludeCameraId?: string
) {
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

  if (excludeCameraId) {
    query._id = { $ne: new Types.ObjectId(excludeCameraId) };
  }

  return Camera.find(query).select('_id name location status rtspUrl activeAlerts').lean();
}

// ─────────────────────────────────────────────────────────────────────────────
// Primary entry point: called when AI service detects a suspect on a camera
// ─────────────────────────────────────────────────────────────────────────────
export async function triggerSuspectRelay(params: {
  cameraId: string;
  suspectType: 'KNOWN' | 'UNKNOWN';
  personId?: string;       // for known missing person
  unknownPersonId?: string; // for recurring unknown
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
    logger.warn({ cameraId }, '[SuspectRelay] Detecting camera not found');
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

  // ── 4. Build the relay hop for this detection ──────────────────────────────
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
    // Brand new alert
    const alertId = await generateAlertId();
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
      relayChain: [newHop],
      radiusMeters,
      snapshotObjectKey,
      triggerSimilarity: similarity,
      expiresAt: new Date(Date.now() + ALERT_TTL_MS),
    });
    logger.info({ alertId: alert.alertId, suspectLabel }, '[SuspectRelay] New alert created');
  } else {
    // Extend existing alert with new hop
    await SuspectAlert.updateOne(
      { _id: alert._id },
      {
        $push: {
          relayChain: newHop,
          confirmedCameraIds: new Types.ObjectId(cameraId),
        },
        $set: {
          lastDetectedCameraId: new Types.ObjectId(cameraId),
          expiresAt: new Date(Date.now() + ALERT_TTL_MS), // refresh expiry
          snapshotObjectKey: snapshotObjectKey || alert.snapshotObjectKey,
        },
        // Remove from alerted (it's now confirmed)
        $pull: { alertedCameraIds: new Types.ObjectId(cameraId) },
      }
    );
    alert = await SuspectAlert.findById(alert._id).lean() as any;
    logger.info({ alertId: alert!.alertId, hop: hopIndex }, '[SuspectRelay] Relay hop confirmed');
  }

  if (!alert) return null;

  // ── 6. Find adjacent cameras and mark them ALERTED ────────────────────────
  const nearbyCameras = await getNearbyCameras(lat, lng, radiusMeters, cameraId);

  const newAlertedIds: Types.ObjectId[] = [];
  for (const cam of nearbyCameras) {
    const camAlerts: Types.ObjectId[] = (cam as any).activeAlerts || [];
    const alreadyAlerted = camAlerts.some((id) => id.equals(alert!._id));
    if (!alreadyAlerted) {
      await Camera.updateOne(
        { _id: cam._id },
        { $addToSet: { activeAlerts: alert!._id } }
      );
      newAlertedIds.push(cam._id as Types.ObjectId);
    }
  }

  // Save alerted camera IDs to the alert document
  if (newAlertedIds.length > 0) {
    await SuspectAlert.updateOne(
      { _id: alert._id },
      { $addToSet: { alertedCameraIds: { $each: newAlertedIds } } }
    );
  }

  // ── 7. Emit real-time Socket.IO events ────────────────────────────────────
  const freshAlert = await SuspectAlert.findById(alert._id)
    .populate('originCameraId', 'name location')
    .populate('lastDetectedCameraId', 'name location')
    .populate('alertedCameraIds', 'name location status')
    .populate('confirmedCameraIds', 'name location')
    .lean();

  if (hopIndex === 0) {
    // First detection → full alert blast
    emitSuspectRelayAlert({
      alertId: freshAlert!.alertId,
      suspectType: freshAlert!.suspectType,
      suspectLabel: freshAlert!.suspectLabel,
      snapshotObjectKey: freshAlert!.snapshotObjectKey,
      triggerSimilarity: freshAlert!.triggerSimilarity,
      originCamera: freshAlert!.originCameraId,
      alertedCameras: freshAlert!.alertedCameraIds,
      relayChain: freshAlert!.relayChain,
      createdAt: freshAlert!.createdAt,
    });
  } else {
    // Subsequent hop → update trail
    emitSuspectRelayUpdated({
      alertId: freshAlert!.alertId,
      suspectLabel: freshAlert!.suspectLabel,
      lastDetectedCamera: freshAlert!.lastDetectedCameraId,
      alertedCameras: freshAlert!.alertedCameraIds,
      confirmedCameras: freshAlert!.confirmedCameraIds,
      relayChain: freshAlert!.relayChain,
      updatedAt: new Date(),
    });
  }

  return freshAlert as any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolve an alert (manually by admin or when suspect is apprehended)
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveAlert(alertId: string, reason = 'Manual resolution') {
  const alert = await SuspectAlert.findOne({ alertId });
  if (!alert) return null;
  if (alert.status !== 'ACTIVE') return alert;

  // Clear activeAlerts from all cameras in this chain
  const allCameraIds = [
    ...alert.alertedCameraIds,
    ...alert.confirmedCameraIds,
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
      },
    },
    { new: true }
  ).lean();

  emitSuspectRelayResolved({
    alertId,
    reason,
    resolvedAt: new Date(),
  });

  logger.info({ alertId, reason }, '[SuspectRelay] Alert resolved');
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
    logger.info({ alertId: alert.alertId }, '[SuspectRelay] Alert auto-expired');
  }

  return stale.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// List alerts with pagination and optional status filter
// ─────────────────────────────────────────────────────────────────────────────
export async function getAlerts(
  page = 1,
  limit = 20,
  status?: string
) {
  const query: any = {};
  if (status) query.status = status;

  const [alerts, total] = await Promise.all([
    SuspectAlert.find(query)
      .populate('originCameraId', 'name location')
      .populate('lastDetectedCameraId', 'name location')
      .populate('alertedCameraIds', 'name location status')
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
    ],
  })
    .select('alertId suspectLabel suspectType snapshotObjectKey triggerSimilarity createdAt')
    .lean();
}
