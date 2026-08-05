/**
 * SuspectAlert.ts
 * Tracks an active relay-chase session across the city camera network.
 *
 * Lifecycle:
 *   ACTIVE  →  RESOLVED (manually by admin) | EXPIRED (auto after 2h inactivity)
 *
 * When a suspect is detected on Camera A, a SuspectAlert is created.
 * Adjacent cameras within radiusMeters are flagged as ALERTED.
 * Each new confirmation extends the relayChain and alerts the next ring.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type SuspectAlertStatus = 'ACTIVE' | 'RESOLVED' | 'EXPIRED';
export type SuspectType = 'KNOWN' | 'UNKNOWN';

export interface IRelayHop {
  cameraId: Types.ObjectId;
  cameraName: string;
  locationName: string;
  latitude: number;
  longitude: number;
  detectedAt: Date;
  similarity: number;
  snapshotObjectKey?: string;
  hopIndex: number; // 0 = origin
}

export interface ISuspectAlert extends Document {
  alertId: string;                    // e.g. "ALERT-000001"
  suspectType: SuspectType;
  personId?: Types.ObjectId;          // ref: Complaint (known missing person)
  unknownPersonId?: Types.ObjectId;   // ref: UnknownPerson
  suspectLabel: string;               // display name: missingPersonName or unknownId

  status: SuspectAlertStatus;

  originCameraId: Types.ObjectId;     // where suspect was FIRST detected
  lastDetectedCameraId: Types.ObjectId;

  alertedCameraIds: Types.ObjectId[]; // all cameras that received the alert
  confirmedCameraIds: Types.ObjectId[]; // cameras that confirmed a sighting
  frontierCameraIds: Types.ObjectId[]; // cameras currently STREAMING (watching for suspect)
  prunedCameraIds: Types.ObjectId[];   // cameras stopped — suspect went a different way

  relayChain: IRelayHop[];            // ordered trail of confirmed detections

  radiusMeters: number;               // search radius for adjacent alert spread
  snapshotObjectKey?: string;         // representative snapshot of suspect
  triggerSimilarity: number;          // confidence that triggered the alert

  resolvedAt?: Date;
  resolvedReason?: string;
  expiresAt: Date;                    // auto-expire timestamp

  createdAt: Date;
  updatedAt: Date;
}

const RelayHopSchema = new Schema<IRelayHop>(
  {
    cameraId: { type: Schema.Types.ObjectId, ref: 'Camera', required: true },
    cameraName: { type: String, required: true },
    locationName: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    detectedAt: { type: Date, required: true },
    similarity: { type: Number, required: true, min: 0, max: 1 },
    snapshotObjectKey: { type: String },
    hopIndex: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const SuspectAlertSchema = new Schema<ISuspectAlert>(
  {
    alertId: { type: String, required: true, unique: true },

    suspectType: {
      type: String,
      enum: ['KNOWN', 'UNKNOWN'],
      required: true,
    },
    personId: { type: Schema.Types.ObjectId, ref: 'Complaint' },
    unknownPersonId: { type: Schema.Types.ObjectId, ref: 'UnknownPerson' },
    suspectLabel: { type: String, required: true },

    status: {
      type: String,
      enum: ['ACTIVE', 'RESOLVED', 'EXPIRED'],
      default: 'ACTIVE',
    },

    originCameraId: { type: Schema.Types.ObjectId, ref: 'Camera', required: true },
    lastDetectedCameraId: { type: Schema.Types.ObjectId, ref: 'Camera', required: true },

    alertedCameraIds: [{ type: Schema.Types.ObjectId, ref: 'Camera' }],
    confirmedCameraIds: [{ type: Schema.Types.ObjectId, ref: 'Camera' }],
    // Cameras currently actively streaming (watching for suspect in live feed)
    frontierCameraIds: [{ type: Schema.Types.ObjectId, ref: 'Camera' }],
    // Cameras that were stopped because suspect moved a different direction
    prunedCameraIds: [{ type: Schema.Types.ObjectId, ref: 'Camera' }],

    relayChain: { type: [RelayHopSchema], default: [] },

    radiusMeters: { type: Number, default: 1000, min: 100, max: 10000 },
    snapshotObjectKey: { type: String },
    triggerSimilarity: { type: Number, required: true, min: 0, max: 1 },

    resolvedAt: { type: Date },
    resolvedReason: { type: String },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h
    },
  },
  { timestamps: true, collection: 'suspectalerts' }
);

// Indexes
SuspectAlertSchema.index({ alertId: 1 }, { unique: true });
SuspectAlertSchema.index({ status: 1 });
SuspectAlertSchema.index({ personId: 1 });
SuspectAlertSchema.index({ unknownPersonId: 1 });
SuspectAlertSchema.index({ originCameraId: 1 });
SuspectAlertSchema.index({ alertedCameraIds: 1 });
SuspectAlertSchema.index({ expiresAt: 1 });
SuspectAlertSchema.index({ createdAt: -1 });

export const SuspectAlert = mongoose.model<ISuspectAlert>('SuspectAlert', SuspectAlertSchema);
