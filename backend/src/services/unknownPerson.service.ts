/**
 * unknownPerson.service.ts
 * Core business logic for recurring unknown person detection & human review.
 */

import { Types } from 'mongoose';
import { UnknownPerson, UnknownPersonStatus } from '../models/UnknownPerson';
import { Sighting } from '../models/Sighting';
import { addNotification, broadcastToRole } from './notification.service';
import { emitUnknownStatusChange } from '../socket/socket';
import { SystemLog } from '../models/SystemLog';

export interface UnknownPersonFilter {
  status?: UnknownPersonStatus;
  cameraId?: string;
  videoId?: string;
  startDate?: string;
  endDate?: string;
  isReviewed?: boolean;
}

/**
 * Get all unknown persons with pagination and filtering.
 * Never exposes raw 512D face embeddings to the frontend.
 */
export async function getAllUnknownPersons(
  page = 1,
  limit = 20,
  filterParams: UnknownPersonFilter = {}
) {
  const query: Record<string, unknown> = {};

  if (filterParams.status) {
    query.status = filterParams.status;
  }
  if (filterParams.cameraId) {
    query.distinctCameraIds = new Types.ObjectId(filterParams.cameraId);
  }
  if (filterParams.videoId) {
    query.distinctVideoIds = new Types.ObjectId(filterParams.videoId);
  }
  if (filterParams.isReviewed !== undefined) {
    query.isReviewed = filterParams.isReviewed;
  }
  if (filterParams.startDate || filterParams.endDate) {
    query.lastSeen = {};
    if (filterParams.startDate) {
      (query.lastSeen as any).$gte = new Date(filterParams.startDate);
    }
    if (filterParams.endDate) {
      (query.lastSeen as any).$lte = new Date(filterParams.endDate);
    }
  }

  const [unknownPersons, total] = await Promise.all([
    UnknownPerson.find(query)
      .select('-representativeEmbedding')
      .sort({ distinctVideoCount: -1, lastSeen: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    UnknownPerson.countDocuments(query),
  ]);

  return { unknownPersons, total };
}

/**
 * Get a single unknown person by unknownId (e.g. U-000001) or MongoDB _id.
 */
export async function getUnknownPersonById(idOrUnknownId: string) {
  const isObjectId = Types.ObjectId.isValid(idOrUnknownId);
  const query = isObjectId
    ? { $or: [{ _id: idOrUnknownId }, { unknownId: idOrUnknownId }] }
    : { unknownId: idOrUnknownId };

  return UnknownPerson.findOne(query)
    .select('-representativeEmbedding')
    .populate('appearances.cameraId', 'name location')
    .populate('appearances.videoId', 'originalName')
    .populate('reviewedBy', 'name email')
    .populate('associatedCaseId', 'complaintId missingPersonName status')
    .lean();
}

/**
 * Get paginated appearances timeline for a given unknown person.
 */
export async function getAppearances(unknownId: string, page = 1, limit = 20) {
  const person = await UnknownPerson.findOne({ unknownId })
    .select('appearances')
    .populate('appearances.cameraId', 'name location')
    .populate('appearances.videoId', 'originalName')
    .lean();

  if (!person) return { appearances: [], total: 0 };

  // Sort appearances chronologically (newest first)
  const sorted = [...(person.appearances || [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const total = sorted.length;
  const paginated = sorted.slice((page - 1) * limit, page * limit);

  return { appearances: paginated, total };
}

/**
 * Convenience query for recurring status (RECURRING or REVIEW_REQUIRED).
 */
export async function getRecurring(page = 1, limit = 20) {
  return getAllUnknownPersons(page, limit, { status: 'RECURRING' });
}

/**
 * Convenience query for review-required status (REVIEW_REQUIRED only).
 */
export async function getReviewRequired(page = 1, limit = 20) {
  return getAllUnknownPersons(page, limit, { status: 'REVIEW_REQUIRED' });
}

/**
 * Human review workflow for recurring unknown identities.
 * Allows marking as reviewed, associating with a case, or dismissing recurrence.
 * Creates an audit record in SystemLog.
 */
export async function markReviewed(
  unknownId: string,
  userId: string,
  action: 'reviewed' | 'associated' | 'dismissed',
  notes?: string,
  caseId?: string
) {
  const updateData: Record<string, unknown> = {
    isReviewed: true,
    reviewedBy: new Types.ObjectId(userId),
    reviewedAt: new Date(),
    reviewAction: action,
    reviewNotes: notes || '',
  };

  if (caseId && Types.ObjectId.isValid(caseId)) {
    updateData.associatedCaseId = new Types.ObjectId(caseId);
  }

  const updated = await UnknownPerson.findOneAndUpdate(
    { unknownId },
    { $set: updateData },
    { new: true }
  )
    .select('-representativeEmbedding')
    .populate('reviewedBy', 'name email')
    .lean();

  if (!updated) return null;

  // Create audit record
  await SystemLog.create({
    userId: new Types.ObjectId(userId),
    action: `UNKNOWN_PERSON_${action.toUpperCase()}`,
    resource: `UnknownPerson:${unknownId}`,
    details: {
      unknownId,
      action,
      notes,
      caseId,
      distinctVideoCount: updated.distinctVideoCount,
      distinctCameraCount: updated.distinctCameraCount,
    },
  }).catch((err) => console.error('Failed to log audit event:', err));

  return updated;
}

/**
 * Aggregate stats for dashboard & metric cards.
 */
export async function getStats() {
  const [total, recurring, reviewRequired, reviewed] = await Promise.all([
    UnknownPerson.countDocuments(),
    UnknownPerson.countDocuments({ status: 'RECURRING' }),
    UnknownPerson.countDocuments({ status: 'REVIEW_REQUIRED' }),
    UnknownPerson.countDocuments({ isReviewed: true }),
  ]);

  return { total, recurring, reviewRequired, reviewed };
}

/**
 * Process a status change webhook from the Python AI microservice.
 * Only emits real-time events and creates notifications on status transitions!
 */
export async function processStatusChangeWebhook(data: {
  unknownId: string;
  oldStatus: string;
  newStatus: UnknownPersonStatus;
  distinctVideoCount: number;
  distinctCameraCount: number;
}) {
  const { unknownId, oldStatus, newStatus, distinctVideoCount, distinctCameraCount } = data;

  // Emit real-time Socket.IO event to dashboard
  emitUnknownStatusChange({
    unknownId,
    oldStatus,
    newStatus,
    distinctVideoCount,
    distinctCameraCount,
    timestamp: new Date(),
  });

  // Send system notification based on transition
  if (newStatus === 'REVIEW_REQUIRED') {
    await broadcastToRole(['admin', 'station'], {
      title: `Review Required: Anonymous Identity ${unknownId}`,
      message: `Identity ${unknownId} has appeared across ${distinctVideoCount} distinct videos. Human review required.`,
      type: 'warning',
    }).catch((err) => console.error('Failed to broadcast notification:', err));
  } else if (newStatus === 'RECURRING') {
    await addNotification({
      title: `Recurring Unknown Person: ${unknownId}`,
      message: `Identity ${unknownId} has been detected in ${distinctVideoCount} distinct videos.`,
      type: 'info',
    }).catch((err) => console.error('Failed to add notification:', err));
  }
}

// ─── Delete an unknown person and all associated sightings ────────────────────
export async function deleteUnknownPerson(unknownId: string) {
  const person = await UnknownPerson.findOne({ unknownId });
  if (!person) return null;

  // Clean up all sightings associated with this unknown person
  await Sighting.deleteMany({ unknownPersonId: person._id });

  // Delete the unknown person document
  await UnknownPerson.deleteOne({ _id: person._id });

  return person;
}
