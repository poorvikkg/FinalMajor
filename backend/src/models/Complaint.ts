/**
 * Complaint.ts
 * Stores user-submitted complaints about camera issues or incidents.
 * Supports priority, status tracking, and assignment to operators/admins.
 */

import mongoose, { Schema, Document } from 'mongoose';
import { IComplaint } from '../types';

export interface IComplaintDocument extends Omit<IComplaint, '_id'>, Document {}

const ComplaintSchema = new Schema<IComplaintDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true },
    type: {
      type: String,
      enum: ['camera_issue', 'false_detection', 'system_error', 'unauthorized_access', 'other'],
      required: true,
    },
    cameraId: {
      type: Schema.Types.ObjectId,
      ref: 'Camera',
    },
    incidentAt: {
      type: Date,
      required: [true, 'Incident date/time is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: 2000,
    },
    attachments: [{ type: String }], // file paths of uploaded suspect/evidence photos
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    remarks: { type: String, maxlength: 1000 },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

ComplaintSchema.index({ status: 1 });
ComplaintSchema.index({ priority: 1 });
ComplaintSchema.index({ createdAt: -1 });
ComplaintSchema.index({ assignedTo: 1 });

export const Complaint = mongoose.model<IComplaintDocument>('Complaint', ComplaintSchema);
