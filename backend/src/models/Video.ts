/**
 * Video.ts
 * Mongoose model for uploaded surveillance videos.
 * Tracks upload details and AI processing status.
 */

import mongoose, { Schema, Document } from 'mongoose';
import { IVideo } from '../types';

export interface IVideoDocument extends Omit<IVideo, '_id'>, Document {}

const VideoSchema = new Schema<IVideoDocument>(
  {
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    duration: { type: Number }, // in seconds
    path: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sourceType: {
      type: String,
      enum: ['REGISTERED_CCTV', 'OTHER_LOCATION'],
      default: 'OTHER_LOCATION',
    },
    location: {
      name: { type: String, trim: true },
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
    cameraId: {
      type: Schema.Types.ObjectId,
      ref: 'Camera',
    },
    status: {
      type: String,
      enum: ['uploaded', 'queued', 'processing', 'completed', 'failed'],
      default: 'uploaded',
    },
    // Will be populated by the AI service once processing is complete
    processingResult: { type: Schema.Types.Mixed },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

// Indexes for listing and filtering videos
VideoSchema.index({ uploadedBy: 1 });
VideoSchema.index({ status: 1 });
VideoSchema.index({ createdAt: -1 });

export const Video = mongoose.model<IVideoDocument>('Video', VideoSchema);
