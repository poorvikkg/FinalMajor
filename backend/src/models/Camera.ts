/**
 * Camera.ts
 * Mongoose model for surveillance cameras.
 * Supports IP cameras, RTSP streams, USB cameras, and cloud cameras.
 */

import mongoose, { Schema, Document } from 'mongoose';
import { ICamera } from '../types';

export interface ICameraDocument extends Omit<ICamera, '_id'>, Document {}

const CameraSchema = new Schema<ICameraDocument>(
  {
    name: {
      type: String,
      required: [true, 'Camera name is required'],
      trim: true,
      maxlength: 100,
    },
    location: {
      type: String,
      required: [true, 'Camera location is required'],
      trim: true,
    },
    rtspUrl: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['ip', 'rtsp', 'usb', 'cloud'],
      required: true,
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'maintenance'],
      default: 'offline',
    },
    isActive: { type: Boolean, default: true },
    lastActive: { type: Date },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes for common queries
CameraSchema.index({ status: 1 });
CameraSchema.index({ isActive: 1 });
CameraSchema.index({ addedBy: 1 });

export const Camera = mongoose.model<ICameraDocument>('Camera', CameraSchema);
