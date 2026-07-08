/**
 * RecognitionLog.ts
 * Stores each face detection event from live cameras or uploaded videos.
 * Records who was detected, when, where, and with what confidence.
 */

import mongoose, { Schema, Document } from 'mongoose';
import { IRecognitionLog } from '../types';

export interface IRecognitionLogDocument extends Omit<IRecognitionLog, '_id'>, Document {}

const RecognitionLogSchema = new Schema<IRecognitionLogDocument>(
  {
    personName: { type: String, trim: true }, // undefined if unknown person
    isUnknown: { type: Boolean, default: false },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    cameraId: {
      type: Schema.Types.ObjectId,
      ref: 'Camera',
    },
    videoId: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
    },
    snapshot: { type: String }, // path to the captured face image
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for time-range queries and filtering by camera
RecognitionLogSchema.index({ timestamp: -1 });
RecognitionLogSchema.index({ cameraId: 1, timestamp: -1 });
RecognitionLogSchema.index({ isUnknown: 1 });

export const RecognitionLog = mongoose.model<IRecognitionLogDocument>(
  'RecognitionLog',
  RecognitionLogSchema
);
