/**
 * complaint.repository.ts
 * Database queries for the Complaint collection.
 */

import { Complaint, IComplaintDocument } from '../models/Complaint';
import { PaginationOptions } from '../utils/pagination';

export async function findAllComplaints(
  pagination: PaginationOptions,
  filter: Record<string, unknown> = {}
): Promise<{ complaints: IComplaintDocument[]; total: number }> {
  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .skip(pagination.skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .lean(),
    Complaint.countDocuments(filter),
  ]);
  return { complaints: complaints as any, total };
}

export async function findComplaintById(id: string): Promise<IComplaintDocument | null> {
  return Complaint.findById(id)
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .lean() as any;
}

export async function findComplaintByComplaintId(complaintId: string): Promise<IComplaintDocument | null> {
  return Complaint.findOne({ complaintId })
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .lean() as any;
}

export async function createComplaint(
  data: Partial<IComplaintDocument>
): Promise<IComplaintDocument> {
  const complaint = new Complaint(data);
  return complaint.save();
}

export async function updateComplaint(
  id: string,
  data: Partial<IComplaintDocument>
): Promise<IComplaintDocument | null> {
  return Complaint.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean() as any;
}

export async function deleteComplaint(id: string): Promise<IComplaintDocument | null> {
  return Complaint.findByIdAndDelete(id).lean() as any;
}

export async function countComplaintsByStatus() {
  return Complaint.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
}

export async function getLastComplaintNumber(): Promise<number> {
  // Used to generate sequential complaint IDs like MP-20260709-0042
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const regex = new RegExp(`^MP-${dateStr}-`);
  const count = await Complaint.countDocuments({ complaintId: { $regex: regex } });
  return count;
}
