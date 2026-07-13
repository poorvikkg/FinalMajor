/**
 * webhook.controller.ts
 *
 * Handles incoming webhooks from the Python AI microservice for live stream detections.
 */

import { Request, Response } from 'express';
import * as recognitionService from '../services/recognition.service';
import * as suspectService from '../services/suspect.service';
import * as complaintRepo from '../repositories/complaint.repository';
import { env } from '../config/env';

export async function handleAiRecognitionWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { cameraId, timestamp, mode, detection } = req.body;

    if (!detection) {
       res.status(400).json({ success: false, message: 'No detection data' });
       return;
    }

    const { track_id, user_id, confidence, snapshot, embedding } = detection;
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

    // 1. Log the recognition (this also sends websocket/UI notifications for known and unknown faces)
    await recognitionService.logRecognition({
      personName,
      isUnknown,
      confidence,
      cameraId,
      snapshot,
      timestamp: new Date(timestamp * 1000), // Python sends seconds
    });

    // 2. If it's unknown and has an embedding, send it to the suspect clustering service
    if (isUnknown && embedding && Array.isArray(embedding) && embedding.length === 512) {
      await suspectService.processUnknownFace({
        embedding,
        snapshot,
        confidence,
        sourceType: 'camera',
        sourceId: cameraId,
        timestamp: new Date(timestamp * 1000),
      });
    }

    res.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('[Webhook Error]', error);
    res.status(500).json({ success: false, message: 'Internal server error processing webhook' });
  }
}
