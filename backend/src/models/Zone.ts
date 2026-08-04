/**
 * Zone.ts
 * Geofence zones for the city CCTV network.
 * Admins draw polygon zones on the map; the system detects when suspects enter them.
 *
 * Zone Types:
 *   HIGH_SECURITY — military/govt areas: auto-escalate to CRITICAL
 *   RESTRICTED    — schools/hospitals: elevated priority alerts
 *   WATCH         — commercial/public: standard monitoring
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type ZoneType = 'HIGH_SECURITY' | 'RESTRICTED' | 'WATCH';

export interface IZone extends Document {
  zoneId: string;             // e.g. ZONE-000001
  name: string;
  description?: string;
  type: ZoneType;
  color: string;              // hex color for map overlay
  isActive: boolean;
  addedBy: Types.ObjectId;

  // GeoJSON Polygon for $geoIntersects queries
  boundary: {
    type: 'Polygon';
    coordinates: number[][][]; // [[[lng,lat],[lng,lat],...]]
  };

  // Center point for display
  centerLat: number;
  centerLng: number;

  // Stats
  totalBreaches: number;
  lastBreachedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const ZoneSchema = new Schema<IZone>(
  {
    zoneId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    type: {
      type: String,
      enum: ['HIGH_SECURITY', 'RESTRICTED', 'WATCH'],
      required: true,
      default: 'WATCH',
    },
    color: { type: String, default: '#f59e0b' },
    isActive: { type: Boolean, default: true },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    boundary: {
      type: {
        type: String,
        enum: ['Polygon'],
        required: true,
        default: 'Polygon',
      },
      coordinates: {
        type: [[[Number]]],
        required: true,
      },
    },

    centerLat: { type: Number, required: true, default: 0 },
    centerLng: { type: Number, required: true, default: 0 },

    totalBreaches: { type: Number, default: 0 },
    lastBreachedAt: { type: Date },
  },
  { timestamps: true, collection: 'zones' }
);

// 2dsphere index for $geoIntersects queries
ZoneSchema.index({ boundary: '2dsphere' });
ZoneSchema.index({ isActive: 1 });
ZoneSchema.index({ type: 1 });
ZoneSchema.index({ addedBy: 1 });

export const Zone = mongoose.model<IZone>('Zone', ZoneSchema);
