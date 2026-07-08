/**
 * complaint.service.ts
 * Business logic for complaint creation and management.
 */

import { AppError } from '../middlewares/error.middleware';
import * as complaintRepo from '../repositories/complaint.repository';
import { CreateComplaintInput, UpdateComplaintInput } from '../validators/complaint.validator';
import { Types } from 'mongoose';
import { addNotification } from './notification.service';

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

export async function createComplaint(input: CreateComplaintInput, userId?: Types.ObjectId) {
  return complaintRepo.createComplaint({
    ...input,
    incidentAt: new Date(input.incidentAt),
    cameraId: input.cameraId ? new Types.ObjectId(input.cameraId) : undefined,
    createdBy: userId,
  });
}

export async function updateComplaint(id: string, input: UpdateComplaintInput) {
  const complaint = await complaintRepo.updateComplaint(id, {
    ...input,
    assignedTo: input.assignedTo ? new Types.ObjectId(input.assignedTo) : undefined,
  });
  if (!complaint) throw new AppError('Complaint not found', 404);

  if (complaint.createdBy) {
    const notifyMessage = `Complaint status: ${complaint.status.replace(/_/g, ' ').toUpperCase()}.${
      input.remarks ? ` Remark: "${input.remarks}"` : ''
    }`;
    await addNotification({
      title: `Complaint Update #${complaint._id.toString().slice(-6)}`,
      message: notifyMessage,
      type: complaint.status === 'resolved' ? 'success' : 'info',
      userId: complaint.createdBy.toString(),
    }).catch((err) => console.error('Notification trigger failed:', err));
  }

  return complaint;
}

export async function deleteComplaint(id: string) {
  const complaint = await complaintRepo.deleteComplaint(id);
  if (!complaint) throw new AppError('Complaint not found', 404);
  return complaint;
}

export async function getComplaintStats() {
  const stats = await complaintRepo.countComplaintsByStatus();
  return stats.reduce(
    (acc, { _id, count }) => ({ ...acc, [_id]: count }),
    {} as Record<string, number>
  );
}
