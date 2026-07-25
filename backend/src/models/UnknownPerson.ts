/**
 * UnknownPerson.ts
 * Stores recurring unknown face identities clustered across video uploads and CCTV sources.
 *
 * Status Workflow:
 *   UNKNOWN  →  RECURRING  →  REVIEW_REQUIRED
 *
 * An authorized user can later review the evidence and associate the recurring
 * identity with a case if appropriate.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type UnknownPersonStatus = 'UNKNOWN' | 'RECURRING' | 'REVIEW_REQUIRED';

export interface IUnknownPersonAppearance {
  videoId?: Types.ObjectId;
  cameraId?: Types.ObjectId;
  timestamp: Date;
  detectedAt: Date;
  snapshotObjectKey: string;
  trackId?: number;
  similarity: number;
  qualityScore: number;
}

export interface IUnknownPerson extends Document {
  unknownId: string;                     // e.g. "U-000001"
  representativeEmbedding?: number[];    // 512-dim normalized embedding (excluded from API responses)
  representativeSnapshot: string;        // URL or path to best snapshot
  status: UnknownPersonStatus;
  appearanceCount: number;
  distinctVideoCount: number;
  distinctCameraCount: number;
  distinctVideoIds: Types.ObjectId[];
  distinctCameraIds: Types.ObjectId[];
  firstSeen: Date;
  lastSeen: Date;
  appearances: IUnknownPersonAppearance[];

  // Human Review Fields
  isReviewed: boolean;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewAction?: 'reviewed' | 'associated' | 'dismissed';
  associatedCaseId?: Types.ObjectId;
  reviewNotes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const UnknownPersonAppearanceSchema = new Schema<IUnknownPersonAppearance>(
  {
    videoId: { type: Schema.Types.ObjectId, ref: 'Video' },
    cameraId: { type: Schema.Types.ObjectId, ref: 'Camera' },
    timestamp: { type: Date, required: true, default: Date.now },
    detectedAt: { type: Date, required: true, default: Date.now },
    snapshotObjectKey: { type: String, required: true },
    trackId: { type: Number },
    similarity: { type: Number, required: true, min: 0, max: 1 },
    qualityScore: { type: Number, default: 0 },
  },
  { _id: false }
);

const UnknownPersonSchema = new Schema<IUnknownPerson>(
  {
    unknownId: { type: String, required: true, unique: true },
    representativeEmbedding: { type: [Number], select: false },
    representativeSnapshot: { type: String, required: true },
    status: {
      type: String,
      enum: ['UNKNOWN', 'RECURRING', 'REVIEW_REQUIRED'],
      default: 'UNKNOWN',
    },
    appearanceCount: { type: Number, default: 1 },
    distinctVideoCount: { type: Number, default: 0 },
    distinctCameraCount: { type: Number, default: 0 },
    distinctVideoIds: [{ type: Schema.Types.ObjectId, ref: 'Video' }],
    distinctCameraIds: [{ type: Schema.Types.ObjectId, ref: 'Camera' }],
    firstSeen: { type: Date, required: true, default: Date.now },
    lastSeen: { type: Date, required: true, default: Date.now },
    appearances: { type: [UnknownPersonAppearanceSchema], default: [] },

    // Human Review Fields
    isReviewed: { type: Boolean, default: false },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewAction: {
      type: String,
      enum: ['reviewed', 'associated', 'dismissed'],
    },
    associatedCaseId: { type: Schema.Types.ObjectId, ref: 'Complaint' },
    reviewNotes: { type: String },
  },
  { timestamps: true, collection: 'unknownpersons' }
);

// Indexes
UnknownPersonSchema.index({ unknownId: 1 }, { unique: true });
UnknownPersonSchema.index({ status: 1 });
UnknownPersonSchema.index({ distinctVideoCount: -1 });
UnknownPersonSchema.index({ distinctCameraCount: -1 });
UnknownPersonSchema.index({ lastSeen: -1 });
UnknownPersonSchema.index({ isReviewed: 1 });

export const UnknownPerson = mongoose.model<IUnknownPerson>(
  'UnknownPerson',
  UnknownPersonSchema
);
