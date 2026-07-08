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
