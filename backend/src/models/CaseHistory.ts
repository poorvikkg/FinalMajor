/**
 * CaseHistory.ts
 * Records every status change on a missing person complaint.
 * Provides a complete audit trail / timeline of the investigation.
 */

import mongoose, { Schema, Document } from 'mongoose';
import { ICaseHistory } from '../types';

export interface ICaseHistoryDocument extends Omit<ICaseHistory, '_id'>, Document {}

const CaseHistorySchema = new Schema<ICaseHistoryDocument>(
  {
    complaintId: {
      type: Schema.Types.ObjectId,
      ref: 'Complaint',
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: [
        'complaint_registered',
        'under_investigation',
        'searching_cctv',
        'possible_match_found',
        'match_confirmed',
        'false_match',
        'person_found',
        'case_closed',
      ],
    },
    remarks: { type: String, maxlength: 2000 },
    evidenceImages: [{ type: String }],      // MinIO URLs of evidence screenshots
    cctvCameraId: { type: String, trim: true },
    detectionTimestamp: { type: Date },
    confidenceScore: { type: Number, min: 0, max: 100 }, // percentage
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    smsSent: { type: Boolean, default: false }, // prevents duplicate SMS
  },
  { timestamps: true }
);

CaseHistorySchema.index({ complaintId: 1, createdAt: -1 });

export const CaseHistory = mongoose.model<ICaseHistoryDocument>('CaseHistory', CaseHistorySchema);
