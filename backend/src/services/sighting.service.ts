/**
 * sighting.service.ts
 * Core business logic for Sighting creation, spatial/temporal queries, deduplication,
 * and Socket.IO notifications.
 */

import { Types } from 'mongoose';
import { Sighting, ISightingDocument, SightingIdentityType, SightingSourceType } from '../models/Sighting';
import { Complaint } from '../models/Complaint';
import { UnknownPerson } from '../models/UnknownPerson';
import { Camera } from '../models/Camera';
import { Video } from '../models/Video';
import { emitNewSighting } from '../socket/socket';
import { checkZoneBreach } from './zone.service';

export interface SightingFilterOptions {
  personId?: string;
  unknownPersonId?: string;
  cameraId?: string;
  videoId?: string;
  identityType?: SightingIdentityType;
  sourceType?: SightingSourceType;
  startDate?: string;
  endDate?: string;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Validates latitude and longitude coordinates.
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Create a new Sighting document with location validation, GeoJSON construction,
 * track deduplication (within 60s), and Socket.IO notification emission.
 */
export async function createSighting(data: {
  identityType: SightingIdentityType;
  personId?: string | Types.ObjectId;
  unknownPersonId?: string | Types.ObjectId;
  cameraId?: string | Types.ObjectId;
  videoId?: string | Types.ObjectId;
  sourceType: SightingSourceType;
  locationName: string;
  latitude: number;
  longitude: number;
  detectedAt?: Date;
  videoTimestampSeconds?: number;
  similarity: number;
  snapshotObjectKey?: string;
  trackId?: string;
}): Promise<ISightingDocument> {
  const isLatValid = validateCoordinates(data.latitude, data.longitude);
  const locationAvailable = isLatValid && (data.latitude !== 0 || data.longitude !== 0 || data.locationName !== '');

  const lat = isLatValid ? data.latitude : 0;
  const lng = isLatValid ? data.longitude : 0;
  const detectedAt = data.detectedAt || new Date();

  const personId = data.personId ? new Types.ObjectId(data.personId.toString()) : undefined;
  const unknownPersonId = data.unknownPersonId ? new Types.ObjectId(data.unknownPersonId.toString()) : undefined;
  const cameraId = data.cameraId ? new Types.ObjectId(data.cameraId.toString()) : undefined;
  const videoId = data.videoId ? new Types.ObjectId(data.videoId.toString()) : undefined;

  // ── Deduplication Check ────────────────────────────────────────────────
  // Prevents frame flooding by checking for an existing sighting for the same
  // (identity, source, trackId) within a 60-second window
  const cooldownCutoff = new Date(detectedAt.getTime() - 60000);
  const dedupeQuery: Record<string, unknown> = {
    detectedAt: { $gte: cooldownCutoff },
  };

  if (personId) dedupeQuery.personId = personId;
  if (unknownPersonId) dedupeQuery.unknownPersonId = unknownPersonId;
  if (cameraId) dedupeQuery.cameraId = cameraId;
  if (videoId) dedupeQuery.videoId = videoId;
  if (data.trackId) dedupeQuery.trackId = data.trackId;

  const existingSighting = await Sighting.findOne(dedupeQuery).lean();
  if (existingSighting) {
    return existingSighting as unknown as ISightingDocument;
  }

  // Construct Sighting document
  const sighting = new Sighting({
    identityType: data.identityType,
    personId,
    unknownPersonId,
    cameraId,
    videoId,
    sourceType: data.sourceType,
    location: {
      name: data.locationName || 'Unknown Location',
      latitude: lat,
      longitude: lng,
      locationGeoJson: {
        type: 'Point',
        coordinates: [lng, lat], // GeoJSON order: [longitude, latitude] !!
      },
    },
    locationAvailable,
    detectedAt,
    videoTimestampSeconds: data.videoTimestampSeconds,
    similarity: data.similarity,
    snapshotObjectKey: data.snapshotObjectKey,
    trackId: data.trackId,
  });

  await sighting.save();

  // ── Parallel: Zone Breach Detection + Socket Populate ─────────────────────
  // Both run concurrently — zone breach does not need to block socket emit
  const [populated] = await Promise.all([
    // Populate for socket emit
    Sighting.findById(sighting._id)
      .populate('personId', 'complaintId missingPersonName attachments')
      .populate('unknownPersonId', 'unknownId status representativeSnapshot')
      .populate('cameraId', 'name location status')
      .populate('videoId', 'originalName filename location recordedAt')
      .lean(),

    // Zone breach check (non-fatal)
    locationAvailable && lat !== 0 && lng !== 0
      ? (async () => {
          try {
            // Resolve suspect label — these two reads are mutually exclusive, no parallel needed
            let suspectLabel = 'Unknown';
            if (data.personId) {
              const complaint = await Complaint.findById(data.personId).select('missingPersonName').lean();
              suspectLabel = complaint?.missingPersonName || 'Known Person';
            } else if (data.unknownPersonId) {
              const unknown = await UnknownPerson.findById(data.unknownPersonId).select('unknownId').lean();
              suspectLabel = unknown?.unknownId || 'Unknown Person';
            }
            await checkZoneBreach(lat, lng, suspectLabel, data.identityType as 'KNOWN' | 'UNKNOWN');
          } catch (err) {
            console.error('[ZoneBreach check error]', err);
          }
        })()
      : Promise.resolve(),
  ]);

  if (populated) {
    emitNewSighting(populated);
  }

  return sighting;
}

/**
 * Get all sightings with pagination, identity filters, date range, and spatial bounding box.
 */
export async function getSightings(
  page = 1,
  limit = 20,
  filters: SightingFilterOptions = {}
) {
  const query: Record<string, unknown> = {};

  if (filters.identityType) {
    query.identityType = filters.identityType;
  }
  if (filters.sourceType) {
    query.sourceType = filters.sourceType;
  }
  if (filters.personId) {
    query.personId = new Types.ObjectId(filters.personId);
  }
  if (filters.unknownPersonId) {
    query.unknownPersonId = new Types.ObjectId(filters.unknownPersonId);
  }
  if (filters.cameraId) {
    query.cameraId = new Types.ObjectId(filters.cameraId);
  }
  if (filters.videoId) {
    query.videoId = new Types.ObjectId(filters.videoId);
  }

  if (filters.startDate || filters.endDate) {
    query.detectedAt = {};
    if (filters.startDate) {
      (query.detectedAt as any).$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      (query.detectedAt as any).$lte = new Date(filters.endDate);
    }
  }

  // Spatial Bounding Box Filter (GeoJSON 2dsphere $geoWithin $box)
  if (
    filters.north !== undefined &&
    filters.south !== undefined &&
    filters.east !== undefined &&
    filters.west !== undefined
  ) {
    query['location.locationGeoJson'] = {
      $geoWithin: {
        $box: [
          [filters.west, filters.south], // Bottom-Left: [minLng, minLat]
          [filters.east, filters.north], // Top-Right:   [maxLng, maxLat]
        ],
      },
    };
  }

  const sortDirection = filters.sortOrder === 'asc' ? 1 : -1;

  const [sightings, total] = await Promise.all([
    Sighting.find(query)
      .populate('personId', 'complaintId missingPersonName attachments status firNumber')
      .populate('unknownPersonId', 'unknownId status representativeSnapshot')
      .populate('cameraId', 'name location status')
      .populate('videoId', 'originalName filename location recordedAt')
      .sort({ detectedAt: sortDirection })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Sighting.countDocuments(query),
  ]);

  return { sightings, total };
}

/**
 * Get chronological sighting timeline for a registered missing person.
 */
export async function getSightingsByPerson(personId: string) {
  const query = { personId: new Types.ObjectId(personId) };
  return Sighting.find(query)
    .populate('cameraId', 'name location status')
    .populate('videoId', 'originalName filename location recordedAt')
    .sort({ detectedAt: 1 }) // Chronological order ASC
    .lean();
}

/**
 * Get chronological sighting timeline for a recurring unknown person.
 */
export async function getSightingsByUnknownPerson(unknownPersonId: string) {
  const isObjectId = Types.ObjectId.isValid(unknownPersonId);

  let targetId: Types.ObjectId | null = null;
  if (isObjectId) {
    targetId = new Types.ObjectId(unknownPersonId);
  } else {
    // Resolve unknownId (e.g. U-000001) to ObjectId
    const doc = await UnknownPerson.findOne({ unknownId: unknownPersonId }).select('_id').lean();
    if (doc) targetId = doc._id as Types.ObjectId;
  }

  if (!targetId) return [];

  return Sighting.find({ unknownPersonId: targetId })
    .populate('cameraId', 'name location status')
    .populate('videoId', 'originalName filename location recordedAt')
    .sort({ detectedAt: 1 }) // Chronological order ASC
    .lean();
}

/**
 * Get a single sighting by ObjectId.
 */
export async function getSightingById(id: string) {
  return Sighting.findById(id)
    .populate('personId', 'complaintId missingPersonName attachments status firNumber reporterName')
    .populate('unknownPersonId', 'unknownId status representativeSnapshot appearanceCount distinctVideoCount distinctCameraCount')
    .populate('cameraId', 'name location status rtspUrl ipAddress type')
    .populate('videoId', 'originalName filename location recordedAt path duration')
    .lean();
}
