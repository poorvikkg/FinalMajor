/**
 * recognition.service.ts
 * Business logic for recognition logs and unknown face alerts.
 */

import { Types } from 'mongoose';
import * as recognitionRepo from '../repositories/recognition.repository';
import { addNotification } from './notification.service';

export async function getLogs(page: number, limit: number, cameraId?: string, videoId?: string, personName?: string) {
  const filter: Record<string, unknown> = {};
  if (cameraId) filter.cameraId = cameraId;
  if (videoId) filter.videoId = videoId;
  if (personName) filter.personName = { $regex: new RegExp(personName, 'i') };
  return recognitionRepo.findAllLogs({ page, limit, skip: (page - 1) * limit }, filter);
}

export async function getUnknownFaces(page: number, limit: number) {
  return recognitionRepo.findAllUnknownFaces({ page, limit, skip: (page - 1) * limit });
}

export async function getDetectionsByDay(days: number) {
  return recognitionRepo.getDetectionsByDay(days);
}

export async function logRecognition(data: {
  personName?: string;
  isUnknown: boolean;
  confidence: number;
  cameraId?: string;
  videoId?: string;
  snapshot?: string;
  timestamp?: Date;
}) {
  const log = await recognitionRepo.createLog({
    personName: data.personName,
    isUnknown: data.isUnknown,
    confidence: data.confidence,
    cameraId: data.cameraId ? new Types.ObjectId(data.cameraId) : undefined,
    videoId: data.videoId ? new Types.ObjectId(data.videoId) : undefined,
    snapshot: data.snapshot,
    timestamp: data.timestamp || new Date(),
  });

  if (data.isUnknown) {
    await addNotification({
      title: 'Alert: Unknown Face Detected',
      message: `An unidentified person was detected with ${Math.round(data.confidence * 100)}% confidence.`,
      type: 'alert',
    }).catch((err) => console.error('Unknown face notification failed:', err));
  } else if (data.personName) {
    await addNotification({
      title: 'Alert: Target Subject Spotted',
      message: `Subject "${data.personName}" was recognized with ${Math.round(data.confidence * 100)}% confidence.`,
      type: 'warning',
    }).catch((err) => console.error('Subject match notification failed:', err));
  }

  return log;
}

// AI Integration stubs — called by external Python AI service via webhook
export async function registerFace(_data: { name: string; images: string[] }) {
  return { message: 'Face registration queued for AI processing' };
}

export async function recognize(_imageBase64: string) {
  return { message: 'Recognition request sent to AI service' };
}

export async function deleteLog(id: string) {
  return recognitionRepo.deleteLog(id);
}
