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
      name: { type: String, required: true, trim: true },
      latitude: { type: Number, required: true, min: -90, max: 90, default: 0 },
      longitude: { type: Number, required: true, min: -180, max: 180, default: 0 },
      locationGeoJson: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
      },
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
    // Active suspect relay alerts this camera is currently watching for
    activeAlerts: [{ type: Schema.Types.ObjectId, ref: 'SuspectAlert' }],
  },
  { timestamps: true }
);

// Indexes for common queries
CameraSchema.index({ status: 1 });
CameraSchema.index({ isActive: 1 });
CameraSchema.index({ addedBy: 1 });
CameraSchema.index({ activeAlerts: 1 });
// 2dsphere index for geospatial $nearSphere relay queries
CameraSchema.index({ 'location.locationGeoJson': '2dsphere' });

export const Camera = mongoose.model<ICameraDocument>('Camera', CameraSchema);
