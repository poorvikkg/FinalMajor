/**
 * UnknownFace.ts
 * Stores face detections where the person is not in the database.
 * Used for the unknown faces alert gallery in the UI.
 */

import mongoose, { Schema, Document } from 'mongoose';
import { IUnknownFace } from '../types';

export interface IUnknownFaceDocument extends Omit<IUnknownFace, '_id'>, Document {}

const UnknownFaceSchema = new Schema<IUnknownFaceDocument>(
  {
    snapshot: {
      type: String,
      required: true,
    },
    cameraId: {
      type: Schema.Types.ObjectId,
      ref: 'Camera',
    },
    videoId: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    isAlerted: { type: Boolean, default: false }, // true if alert was sent
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

UnknownFaceSchema.index({ timestamp: -1 });
UnknownFaceSchema.index({ isAlerted: 1 });
UnknownFaceSchema.index({ cameraId: 1 });

export const UnknownFace = mongoose.model<IUnknownFaceDocument>(
  'UnknownFace',
  UnknownFaceSchema
);
