/**
 * zone.service.ts
 * Geofence zone management and breach detection.
 */

import { Types } from 'mongoose';
import { Zone, IZone } from '../models/Zone';
import { emitZoneBreach } from '../socket/socket';
import { broadcastToRole } from './notification.service';
import { logger } from '../config/logger';

// ─── Auto-generate zoneId ────────────────────────────────────────────────────
async function generateZoneId(): Promise<string> {
  const count = await Zone.countDocuments();
  return `ZONE-${String(count + 1).padStart(6, '0')}`;
}

// ─── Create a new zone ───────────────────────────────────────────────────────
export async function createZone(data: {
  name: string;
  description?: string;
  type: 'HIGH_SECURITY' | 'RESTRICTED' | 'WATCH';
  color?: string;
  coordinates: number[][][]; // GeoJSON polygon coordinates
  centerLat: number;
  centerLng: number;
  userId: string;
}) {
  const zoneId = await generateZoneId();

  const colors: Record<string, string> = {
    HIGH_SECURITY: '#ef4444',
    RESTRICTED: '#f59e0b',
    WATCH: '#3b82f6',
  };

  return Zone.create({
    zoneId,
    name: data.name,
    description: data.description,
    type: data.type,
    color: data.color || colors[data.type],
    isActive: true,
    addedBy: new Types.ObjectId(data.userId),
    boundary: {
      type: 'Polygon',
      coordinates: data.coordinates,
    },
    centerLat: data.centerLat,
    centerLng: data.centerLng,
  });
}

// ─── List all zones ──────────────────────────────────────────────────────────
export async function getAllZones(activeOnly = false) {
  const query = activeOnly ? { isActive: true } : {};
  return Zone.find(query).sort({ createdAt: -1 }).lean();
}

// ─── Delete a zone ───────────────────────────────────────────────────────────
export async function deleteZone(zoneId: string) {
  return Zone.findOneAndDelete({ zoneId });
}

// ─── Toggle zone active/inactive ─────────────────────────────────────────────
export async function toggleZone(zoneId: string) {
  const zone = await Zone.findOne({ zoneId });
  if (!zone) return null;
  zone.isActive = !zone.isActive;
  await zone.save();
  return zone;
}

// ─── Check if a point is inside any active zone ──────────────────────────────
export async function checkZoneBreach(
  lat: number,
  lng: number,
  suspectLabel: string,
  suspectType: 'KNOWN' | 'UNKNOWN',
  alertId?: string
): Promise<IZone[]> {
  if (!lat || !lng || (lat === 0 && lng === 0)) return [];

  const breachedZones = await Zone.find({
    isActive: true,
    boundary: {
      $geoIntersects: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
      },
    },
  }).lean();

  for (const zone of breachedZones) {
    logger.warn({ zoneId: zone.zoneId, suspectLabel }, '[ZoneBreach] Suspect entered zone');

    // Increment breach counter
    await Zone.updateOne(
      { _id: zone._id },
      { $inc: { totalBreaches: 1 }, $set: { lastBreachedAt: new Date() } }
    );

    // Emit real-time socket event
    emitZoneBreach({
      zoneId: zone.zoneId,
      zoneName: zone.name,
      zoneType: zone.type,
      suspectLabel,
      suspectType,
      alertId,
      lat,
      lng,
      timestamp: new Date(),
    });

    // Send notification for HIGH_SECURITY breaches
    if (zone.type === 'HIGH_SECURITY') {
      await broadcastToRole(['admin', 'station'], {
        title: `🚨 HIGH SECURITY ZONE BREACH — ${zone.name}`,
        message: `Suspect "${suspectLabel}" has entered the high-security zone "${zone.name}". Immediate response required.`,
        type: 'alert',
      }).catch((err) => logger.error({ err }, 'Zone breach notification failed'));
    }
  }

  return breachedZones as IZone[];
}
