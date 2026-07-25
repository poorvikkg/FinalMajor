/**
 * Sighting.ts
 * Stores timestamped detection location events for registered (missing) persons
 * and recurring unknown persons.
 *
 * Supports MongoDB 2dsphere spatial indexing for location bounds and proximity queries.
 * GeoJSON coordinates format: [longitude, latitude]
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type SightingIdentityType = 'KNOWN' | 'UNKNOWN';
export type SightingSourceType = 'LIVE_CCTV' | 'UPLOADED_VIDEO';

export interface ISightingLocation {
  name: string;
  latitude: number;
  longitude: number;
  locationGeoJson?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude] !!
  };
}

export interface ISightingDocument extends Document {
  identityType: SightingIdentityType;
  personId?: Types.ObjectId;         // ref: 'Complaint' (Missing Person)
  unknownPersonId?: Types.ObjectId;  // ref: 'UnknownPerson'
  cameraId?: Types.ObjectId;         // ref: 'Camera'
  videoId?: Types.ObjectId;          // ref: 'Video'
  sourceType: SightingSourceType;
  location: ISightingLocation;
  locationAvailable: boolean;
  detectedAt: Date;
  videoTimestampSeconds?: number;
  similarity: number;
  snapshotObjectKey?: string;
  trackId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SightingLocationSchema = new Schema<ISightingLocation>(
  {
    name: { type: String, required: true, trim: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    locationGeoJson: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
  },
  { _id: false }
);

const SightingSchema = new Schema<ISightingDocument>(
  {
    identityType: {
      type: String,
      enum: ['KNOWN', 'UNKNOWN'],
      required: true,
    },
    personId: {
      type: Schema.Types.ObjectId,
      ref: 'Complaint',
    },
    unknownPersonId: {
      type: Schema.Types.ObjectId,
      ref: 'UnknownPerson',
    },
    cameraId: {
      type: Schema.Types.ObjectId,
      ref: 'Camera',
    },
    videoId: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
    },
    sourceType: {
      type: String,
      enum: ['LIVE_CCTV', 'UPLOADED_VIDEO'],
      required: true,
    },
    location: {
      type: SightingLocationSchema,
      required: true,
    },
    locationAvailable: {
      type: Boolean,
      default: true,
    },
    detectedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    videoTimestampSeconds: {
      type: Number,
      min: 0,
    },
    similarity: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    snapshotObjectKey: {
      type: String,
      trim: true,
    },
    trackId: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Indexes for performance and geospatial queries
SightingSchema.index({ 'location.locationGeoJson': '2dsphere' });
SightingSchema.index({ personId: 1, detectedAt: -1 });
SightingSchema.index({ unknownPersonId: 1, detectedAt: -1 });
SightingSchema.index({ cameraId: 1, detectedAt: -1 });
SightingSchema.index({ videoId: 1 });
SightingSchema.index({ identityType: 1, detectedAt: -1 });
SightingSchema.index({ sourceType: 1 });
SightingSchema.index({ detectedAt: -1 });

// Ensure at least one identity reference exists
SightingSchema.pre('validate', function (next) {
  if (!this.personId && !this.unknownPersonId) {
    return next(new Error('Sighting must reference either a personId or unknownPersonId'));
  }
  next();
});

export const Sighting = mongoose.model<ISightingDocument>('Sighting', SightingSchema);
