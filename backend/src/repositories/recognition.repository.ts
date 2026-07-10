/**
 * recognition.repository.ts
 * Database queries for RecognitionLog and UnknownFace collections.
 */

import { RecognitionLog, IRecognitionLogDocument } from '../models/RecognitionLog';
import { UnknownFace, IUnknownFaceDocument } from '../models/UnknownFace';
import { PaginationOptions } from '../utils/pagination';

// ── Recognition Logs ──────────────────────────────────

export async function findAllLogs(
  pagination: PaginationOptions,
  filter: Record<string, unknown> = {}
): Promise<{ logs: IRecognitionLogDocument[]; total: number }> {
  const [logs, total] = await Promise.all([
    RecognitionLog.find(filter)
      .populate('cameraId', 'name location')
      .populate('videoId', 'originalName')
      .skip(pagination.skip)
      .limit(pagination.limit)
      .sort({ timestamp: -1 })
      .lean(),
    RecognitionLog.countDocuments(filter),
  ]);
  return { logs: logs as any, total };
}

export async function findLogById(id: string): Promise<IRecognitionLogDocument | null> {
  return RecognitionLog.findById(id).populate('cameraId', 'name location').lean() as unknown as IRecognitionLogDocument;
}
export async function createLog(
  data: Partial<IRecognitionLogDocument>
): Promise<IRecognitionLogDocument> {
  return RecognitionLog.create(data);
}

// Count today's recognitions for dashboard stats
export async function countTodayRecognitions(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return RecognitionLog.countDocuments({ timestamp: { $gte: startOfDay }, isUnknown: false });
}

export async function countUnknownDetections(): Promise<number> {
  return RecognitionLog.countDocuments({ isUnknown: true });
}

// Get recognitions per day (for analytics chart)
export async function getDetectionsByDay(days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return RecognitionLog.aggregate([
    { $match: { timestamp: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
        count: { $sum: 1 },
        unknown: { $sum: { $cond: ['$isUnknown', 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

// ── Unknown Faces ──────────────────────────────────────

export async function findAllUnknownFaces(
  pagination: PaginationOptions
): Promise<{ faces: IUnknownFaceDocument[]; total: number }> {
  const [faces, total] = await Promise.all([
    UnknownFace.find()
      .populate('cameraId', 'name location')
      .skip(pagination.skip)
      .limit(pagination.limit)
      .sort({ timestamp: -1 })
      .lean(),
    UnknownFace.countDocuments(),
  ]);
  return { faces: faces as any, total };
}

export async function createUnknownFace(
  data: Partial<IUnknownFaceDocument>
): Promise<IUnknownFaceDocument> {
  return UnknownFace.create(data);
}
