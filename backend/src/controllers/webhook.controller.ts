/**
 * webhook.controller.ts
 *
 * Handles incoming webhooks from the Python AI microservice for live stream detections
 * and status transitions for recurring unknown person detection.
 */

import { Request, Response } from 'express';
import * as recognitionService from '../services/recognition.service';
import * as unknownPersonService from '../services/unknownPerson.service';
import * as complaintRepo from '../repositories/complaint.repository';
import * as sightingService from '../services/sighting.service';
import * as cameraRepo from '../repositories/camera.repository';
import * as relayService from '../services/suspectRelay.service';

export async function handleAiRecognitionWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { cameraId, timestamp, mode, detection } = req.body;

    if (!detection) {
       res.status(400).json({ success: false, message: 'No detection data' });
       return;
    }

    const { track_id, user_id, confidence, snapshot } = detection;
    const isUnknown = (user_id === 'unknown');

    let personName: string | undefined;

    if (!isUnknown) {
      // It's a known person (match)
      try {
        const complaint = await complaintRepo.findComplaintById(user_id);
        personName = complaint?.missingPersonName || `Subject ${user_id.substring(0, 6)}`;
      } catch {
        personName = `Subject ${user_id.substring(0, 6)}`;
      }
    }

    // 1. Log the recognition (sends socket & UI notification)
    await recognitionService.logRecognition({
      personName,
      isUnknown,
      confidence,
      cameraId,
      snapshot,
      timestamp: new Date(timestamp * 1000), // Python sends seconds
    });

    // 2. Resolve camera location and create Sighting
    if (cameraId) {
      try {
        const camera = await cameraRepo.findCameraById(cameraId);
        if (camera) {
          let locName = 'Live Stream Camera';
          let lat = 0;
          let lng = 0;

          if (typeof camera.location === 'object' && camera.location) {
            locName = camera.location.name || camera.name;
            lat = camera.location.latitude || 0;
            lng = camera.location.longitude || 0;
          } else if (typeof camera.location === 'string') {
            locName = camera.location;
          }

          await sightingService.createSighting({
            identityType: isUnknown ? 'UNKNOWN' : 'KNOWN',
            personId: isUnknown ? undefined : user_id,
            unknownPersonId: isUnknown ? undefined : undefined, // Will be linked when unknown identity resolves
            cameraId,
            sourceType: 'LIVE_CCTV',
            locationName: locName,
            latitude: lat,
            longitude: lng,
            detectedAt: new Date((timestamp || Date.now() / 1000) * 1000),
            similarity: confidence || 0.5,
            snapshotObjectKey: snapshot ? `snapshots/${snapshot}` : undefined,
            trackId: track_id ? track_id.toString() : undefined,
          });
        }
      } catch (err) {
        console.error('[Sighting Creation Error]', err);
        // Non-fatal: recognition log succeeded
      }
    }

    // 3. Trigger Suspect Relay Chase Network
    // Fires for KNOWN persons (missing person detected) or UNKNOWN recurring persons on LIVE_CCTV.
    try {
      if (cameraId) {
        if (!isUnknown && user_id) {
          // Known missing person
          await relayService.triggerSuspectRelay({
            cameraId,
            suspectType: 'KNOWN',
            personId: user_id,
            similarity: confidence || 0.5,
            snapshotObjectKey: snapshot ? `snapshots/${snapshot}` : undefined,
          });
        }
        // Note: UNKNOWN relay is triggered via /webhooks/suspect-sighting when unknownPersonId is resolved
      }
    } catch (relayErr) {
      console.error('[SuspectRelay Trigger Error]', relayErr);
      // Non-fatal: relay is an enhancement, not a blocker
    }

    res.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('[Webhook Error]', error);
    res.status(500).json({ success: false, message: 'Internal server error processing webhook' });
  }
}

export async function handleUnknownStatusChangeWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { event, unknownId, oldStatus, newStatus, distinctVideoCount, distinctCameraCount } = req.body;

    if (event !== 'UNKNOWN_STATUS_CHANGED' || !unknownId || !newStatus) {
      res.status(400).json({ success: false, message: 'Invalid status change payload' });
      return;
    }

    await unknownPersonService.processStatusChangeWebhook({
      unknownId,
      oldStatus,
      newStatus,
      distinctVideoCount: distinctVideoCount || 0,
      distinctCameraCount: distinctCameraCount || 0,
    });

    res.json({ success: true, message: 'Status change processed' });
  } catch (error) {
    console.error('[Status Change Webhook Error]', error);
    res.status(500).json({ success: false, message: 'Internal server error processing status change' });
  }
}

/**
 * handleSuspectSightingWebhook
 * Called by the AI service when a camera that was ALERTED confirms detection of the suspect.
 * This triggers the next relay hop — alerting the next ring of adjacent cameras.
 *
 * Body: { cameraId, suspectType, personId?, unknownPersonId?, similarity, snapshotObjectKey? }
 */
export async function handleSuspectSightingWebhook(req: Request, res: Response): Promise<void> {
  try {
    const {
      cameraId,
      suspectType,
      personId,
      unknownPersonId,
      similarity,
      snapshotObjectKey,
      radiusMeters,
    } = req.body;

    if (!cameraId || !suspectType) {
      res.status(400).json({ success: false, message: 'cameraId and suspectType are required' });
      return;
    }

    const alert = await relayService.triggerSuspectRelay({
      cameraId,
      suspectType,
      personId,
      unknownPersonId,
      similarity: similarity || 0.5,
      snapshotObjectKey,
      radiusMeters,
    });

    res.json({
      success: true,
      message: 'Relay hop processed',
      alertId: alert?.alertId,
      relayHops: alert?.relayChain?.length ?? 0,
    });
  } catch (error) {
    console.error('[SuspectSighting Webhook Error]', error);
    res.status(500).json({ success: false, message: 'Internal server error processing suspect sighting' });
  }
}
