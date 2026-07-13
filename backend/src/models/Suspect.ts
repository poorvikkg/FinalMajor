/**
 * Suspect.ts
 * A "Suspect" is an unknown person detected across 3 or more distinct
 * videos or live camera streams. They are automatically promoted from
 * UnknownFace detections based on embedding similarity clustering.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ISuspectSighting {
  sourceType: 'camera' | 'video';
  sourceId?: mongoose.Types.ObjectId;
  sourceName?: string;
  snapshot: string;
  confidence: number;
  timestamp: Date;
}

export interface ISuspect extends Document {
  suspectId: string;             // e.g. "SUSPECT-0001"
  representativeSnapshot: string; // best quality face snapshot
  embedding: number[];           // averaged composite embedding (512-dim)
  sightings: ISuspectSighting[]; // all detections across sources
  distinctSources: number;       // count of unique camera/video IDs
  threatLevel: 'watch' | 'suspicious' | 'high';
  notes?: string;
  isResolved: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SightingSchema = new Schema<ISuspectSighting>(
  {
    sourceType: { type: String, enum: ['camera', 'video'], required: true },
    sourceId:   { type: Schema.Types.ObjectId },
    sourceName: { type: String },
    snapshot:   { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    timestamp:  { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const SuspectSchema = new Schema<ISuspect>(
  {
    suspectId:               { type: String, unique: true },
    representativeSnapshot:  { type: String, required: true },
    embedding:               { type: [Number], required: true },
    sightings:               { type: [SightingSchema], default: [] },
    distinctSources:         { type: Number, default: 1 },
    threatLevel:             { type: String, enum: ['watch', 'suspicious', 'high'], default: 'watch' },
    notes:                   { type: String },
    isResolved:              { type: Boolean, default: false },
    firstSeenAt:             { type: Date, required: true },
    lastSeenAt:              { type: Date, required: true },
  },
  { timestamps: true }
);

// Auto-generate suspectId before saving
SuspectSchema.pre('save', async function (next) {
  if (!this.suspectId) {
    const count = await mongoose.model('Suspect').countDocuments();
    this.suspectId = `SUSPECT-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Indexes
SuspectSchema.index({ lastSeenAt: -1 });
SuspectSchema.index({ distinctSources: -1 });
SuspectSchema.index({ isResolved: 1 });
SuspectSchema.index({ threatLevel: 1 });

export const Suspect = mongoose.model<ISuspect>('Suspect', SuspectSchema);
