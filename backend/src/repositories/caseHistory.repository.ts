/**
 * caseHistory.repository.ts
 * Database queries for the CaseHistory collection.
 */

import { CaseHistory, ICaseHistoryDocument } from '../models/CaseHistory';
import { Types } from 'mongoose';

export async function createHistory(
  data: Partial<ICaseHistoryDocument>
): Promise<ICaseHistoryDocument> {
  const entry = new CaseHistory(data);
  return entry.save();
}

export async function findHistoryByComplaintId(
  complaintId: string
): Promise<ICaseHistoryDocument[]> {
  return CaseHistory.find({ complaintId: new Types.ObjectId(complaintId) })
    .populate('updatedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean() as any;
}

export async function getLastHistoryEntry(
  complaintId: string
): Promise<ICaseHistoryDocument | null> {
  return CaseHistory.findOne({ complaintId: new Types.ObjectId(complaintId) })
    .sort({ createdAt: -1 })
    .lean() as any;
}

export async function markSmsSent(historyId: string): Promise<void> {
  await CaseHistory.findByIdAndUpdate(historyId, { smsSent: true });
}
