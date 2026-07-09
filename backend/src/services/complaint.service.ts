/**
 * complaint.service.ts
 * Business logic for missing person complaint creation and management.
 */

import { AppError } from '../middlewares/error.middleware';
import * as complaintRepo from '../repositories/complaint.repository';
import * as historyRepo from '../repositories/caseHistory.repository';
import { CreateComplaintInput, UpdateComplaintStatusInput, UpdateComplaintInput } from '../validators/complaint.validator';
import { Types } from 'mongoose';
import { addNotification, broadcastToRole } from './notification.service';
import { sendSms, getStatusSmsMessage } from './sms.service';
import { ComplaintStatus } from '../types';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generates a unique complaint ID like MP-20260709-0042
 */
async function generateComplaintId(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const count = await complaintRepo.getLastComplaintNumber();
  const seq = String(count + 1).padStart(4, '0');
  return `MP-${dateStr}-${seq}`;
}

/**
 * Maps status to a human-readable label for notifications.
 */
const STATUS_LABELS: Record<ComplaintStatus, string> = {
  complaint_registered: 'Complaint Registered',
  under_investigation: 'Under Investigation',
  searching_cctv: 'Searching CCTV Footage',
  possible_match_found: 'Possible Match Found',
  match_confirmed: 'Match Confirmed',
  false_match: 'False Match',
  person_found: 'Person Found',
  case_closed: 'Case Closed',
};

const STATUS_NOTIFICATION_TYPE: Record<ComplaintStatus, 'info' | 'warning' | 'success' | 'alert'> = {
  complaint_registered: 'info',
  under_investigation: 'info',
  searching_cctv: 'info',
  possible_match_found: 'warning',
  match_confirmed: 'success',
  false_match: 'warning',
  person_found: 'success',
  case_closed: 'info',
};

// ── Query ────────────────────────────────────────────────────────────────────

export async function getAllComplaints(
  page: number,
  limit: number,
  status?: string,
  priority?: string,
  createdBy?: string
) {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (createdBy) filter.createdBy = createdBy;
  return complaintRepo.findAllComplaints({ page, limit, skip: (page - 1) * limit }, filter);
}

export async function getComplaintById(id: string) {
  const complaint = await complaintRepo.findComplaintById(id);
  if (!complaint) throw new AppError('Complaint not found', 404);
  return complaint;
}

export async function getCaseHistory(complaintId: string) {
  return historyRepo.findHistoryByComplaintId(complaintId);
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createComplaint(input: CreateComplaintInput, userId?: Types.ObjectId) {
  const complaintId = await generateComplaintId();

  const complaint = await complaintRepo.createComplaint({
    ...input,
    complaintId,
    lastSeenTime: new Date(input.lastSeenTime),
    status: 'complaint_registered',
    createdBy: userId,
  });

  // Record initial CaseHistory entry
  await historyRepo.createHistory({
    complaintId: complaint._id as Types.ObjectId,
    status: 'complaint_registered',
    remarks: 'Complaint registered by reporter.',
    updatedBy: userId,
    smsSent: false,
  });

  // Send registration SMS to complainant (non-blocking)
  _sendStatusSms(
    complaint.reporterMobile,
    'complaint_registered',
    complaintId,
    complaint._id.toString()
  ).catch((e) => console.error('[SMS] Failed on registration:', e));

  // Notify operators/admins
  broadcastToRole(['admin', 'operator'], {
    title: `New Missing Person Report — ${complaintId}`,
    message: `Reporter: ${complaint.reporterName}. Missing: ${complaint.missingPersonName || 'Unknown'}. FIR: ${complaint.firNumber || 'Pending'}.`,
    type: 'alert',
  }).catch((e) => console.error('[Notification] Broadcast failed:', e));

  return complaint;
}

// ── Status Update ────────────────────────────────────────────────────────────

export async function updateComplaintStatus(
  id: string,
  input: UpdateComplaintStatusInput,
  operatorId?: Types.ObjectId
) {
  const existing = await complaintRepo.findComplaintById(id);
  if (!existing) throw new AppError('Complaint not found', 404);

  // Update the complaint document
  const updated = await complaintRepo.updateComplaint(id, {
    status: input.status,
    remarks: input.remarks,
  });

  if (!updated) throw new AppError('Failed to update complaint', 500);

  // Check deduplication — has this exact status already been SMS-sent?
  const lastEntry = await historyRepo.getLastHistoryEntry(id);
  const isDuplicate = lastEntry?.status === input.status && lastEntry?.smsSent === true;

  // Create CaseHistory record
  const historyEntry = await historyRepo.createHistory({
    complaintId: new Types.ObjectId(id),
    status: input.status,
    remarks: input.remarks,
    evidenceImages: input.evidenceImages || [],
    cctvCameraId: input.cctvCameraId,
    detectionTimestamp: input.detectionTimestamp ? new Date(input.detectionTimestamp) : undefined,
    confidenceScore: input.confidenceScore,
    updatedBy: operatorId,
    smsSent: false,
  });

  // Send SMS to complainant (skip if duplicate)
  if (!isDuplicate && existing.reporterMobile) {
    const smsSent = await _sendStatusSms(
      existing.reporterMobile,
      input.status,
      existing.complaintId || id,
      id
    );
    if (smsSent) {
      await historyRepo.markSmsSent(historyEntry._id.toString());
    }
  }

  // Notify the user who filed the complaint
  if (existing.createdBy) {
    addNotification({
      title: `Case Update — ${existing.complaintId || id}`,
      message: `Status changed to: ${STATUS_LABELS[input.status]}.${input.remarks ? ` Remark: "${input.remarks}"` : ''}`,
      type: STATUS_NOTIFICATION_TYPE[input.status],
      userId: existing.createdBy.toString(),
    }).catch((e) => console.error('[Notification] Failed:', e));
  }

  // Broadcast to all operators/admins
  broadcastToRole(['admin', 'operator'], {
    title: `Case ${existing.complaintId || id} — ${STATUS_LABELS[input.status]}`,
    message: `Missing: ${existing.missingPersonName || 'Unknown'}. Updated by operator.${input.confidenceScore ? ` Confidence: ${input.confidenceScore}%.` : ''}`,
    type: STATUS_NOTIFICATION_TYPE[input.status],
  }).catch((e) => console.error('[Notification] Broadcast failed:', e));

  return { complaint: updated, historyEntry };
}

// ── Legacy Update (admin override) ──────────────────────────────────────────

export async function updateComplaint(id: string, input: UpdateComplaintInput) {
  const complaint = await complaintRepo.updateComplaint(id, {
    ...input,
    assignedTo: input.assignedTo ? new Types.ObjectId(input.assignedTo) : undefined,
  });
  if (!complaint) throw new AppError('Complaint not found', 404);
  return complaint;
}

// ── Delete ───────────────────────────────────────────────────────────────────

export async function deleteComplaint(id: string) {
  const complaint = await complaintRepo.deleteComplaint(id);
  if (!complaint) throw new AppError('Complaint not found', 404);
  return complaint;
}

// ── Stats ────────────────────────────────────────────────────────────────────

export async function getComplaintStats() {
  const stats = await complaintRepo.countComplaintsByStatus();
  return stats.reduce(
    (acc, { _id, count }) => ({ ...acc, [_id]: count }),
    {} as Record<string, number>
  );
}

// ── Private Helpers ──────────────────────────────────────────────────────────

async function _sendStatusSms(
  mobile: string,
  status: ComplaintStatus,
  complaintId: string,
  _internalId: string
): Promise<boolean> {
  const message = getStatusSmsMessage(status, complaintId);
  if (!message) return false;
  return sendSms(mobile, message);
}
