import type { Sighting } from '../types';

export interface PathPoint {
  latitude: number;
  longitude: number;
  locationName: string;
  detectedAt: string;
  sightingId: string;
  snapshotUrl?: string;
  sequenceNumber: number;
}

export interface PredictedWaypoint {
  latitude: number;
  longitude: number;
  minutesAhead: number;
  estimatedTime: string;
  label: string;
  roadName?: string;
}

export interface PersonPathPrediction {
  personKey: string;
  personName: string;
  identityType: 'KNOWN' | 'UNKNOWN';
  status?: string;
  observedPoints: PathPoint[];
  hasMultipleLocations: boolean;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  averageSpeedKmH: number;
  recentSpeedKmH: number;
  bearingDegrees: number;
  bearingLabel: string;
  cardinalDirection: string;
  predictedWaypoints: PredictedWaypoint[];
  uncertaintyRadiusMeters: number;
  lastSeenTime: string;
  lastSeenLocationName: string;
  isStationary: boolean;
  observedRoadCoords?: [number, number][];
  predictedRoadCoords?: [number, number][];
  roadSummary?: string;
}

const routeCache = new Map<string, { coordinates: [number, number][]; distance: number; duration: number; summary: string }>();

/**
 * Safe image snapshot URL resolver.
 */
export const getSnapshotUrl = (pathStr?: string): string => {
  if (!pathStr) return '';
  let normalized = pathStr.replace(/\\/g, '/').trim();
  if (!normalized) return '';
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;

  const uploadsIndex = normalized.indexOf('uploads/');
  if (uploadsIndex !== -1) {
    normalized = normalized.substring(uploadsIndex);
  } else {
    normalized = normalized.replace(/^\/+/, '');
    normalized = `uploads/${normalized}`;
  }

  return `/${normalized}`;
};

/**
 * Calculates distance between two coordinates in meters using the Haversine formula.
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (typeof lat1 !== 'number' || typeof lng1 !== 'number' || typeof lat2 !== 'number' || typeof lng2 !== 'number') {
    return 0;
  }
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates bearing angle in degrees (0° - 360°) from point 1 to point 2.
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export function getCardinalDirection(bearingDegrees: number): string {
  const directions = [
    'North',
    'North-East',
    'East',
    'South-East',
    'South',
    'South-West',
    'West',
    'North-West',
  ];
  const index = Math.round(bearingDegrees / 45) % 8;
  return directions[index];
}

export function projectDestination(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceMeters: number
): { latitude: number; longitude: number } {
  const R = 6371000;
  const dDivR = distanceMeters / R;
  const brngRad = (bearingDeg * Math.PI) / 180;
  const lat1Rad = (lat * Math.PI) / 180;
  const lng1Rad = (lng * Math.PI) / 180;

  const lat2Rad = Math.asin(
    Math.sin(lat1Rad) * Math.cos(dDivR) +
      Math.cos(lat1Rad) * Math.sin(dDivR) * Math.cos(brngRad)
  );

  const lng2Rad =
    lng1Rad +
    Math.atan2(
      Math.sin(brngRad) * Math.sin(dDivR) * Math.cos(lat1Rad),
      Math.cos(dDivR) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
    );

  return {
    latitude: (lat2Rad * 180) / Math.PI,
    longitude: (lng2Rad * 180) / Math.PI,
  };
}

export function getPersonKey(sighting?: Sighting | null): { key: string; name: string; type: 'KNOWN' | 'UNKNOWN'; status?: string } {
  if (!sighting) return { key: 'unknown', name: 'Unknown Subject', type: 'UNKNOWN' };

  if (sighting.identityType === 'KNOWN' && sighting.personId) {
    const isObj = typeof sighting.personId === 'object' && sighting.personId !== null;
    const pId = isObj ? sighting.personId._id : sighting.personId;
    const name = isObj ? (sighting.personId.missingPersonName || 'Registered Subject') : 'Registered Subject';
    const status = isObj ? sighting.personId.status : undefined;
    return { key: `known_${pId || 'unknown'}`, name, type: 'KNOWN', status };
  }

  if (sighting.unknownPersonId) {
    const isObj = typeof sighting.unknownPersonId === 'object' && sighting.unknownPersonId !== null;
    const uId = isObj ? sighting.unknownPersonId._id : sighting.unknownPersonId;
    const name = isObj
      ? (sighting.unknownPersonId.unknownId || `Unknown Subject (${String(uId).slice(-6)})`)
      : `Unknown Subject (${String(sighting.unknownPersonId).slice(-6)})`;
    const status = isObj ? sighting.unknownPersonId.status : undefined;
    return { key: `unknown_${uId || 'unknown'}`, name, type: 'UNKNOWN', status };
  }

  return { key: `sighting_${sighting._id || 'unknown'}`, name: 'Unclassified Subject', type: sighting.identityType || 'UNKNOWN' };
}

function generateCurvedRoadPoints(
  p1: { latitude: number; longitude: number },
  p2: { latitude: number; longitude: number },
  steps = 8
): [number, number][] {
  const points: [number, number][] = [];
  const lat1 = p1.latitude;
  const lng1 = p1.longitude;
  const lat2 = p2.latitude;
  const lng2 = p2.longitude;

  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;

  const offsetScale = 0.15;
  const ctrlLat = midLat - dLng * offsetScale;
  const ctrlLng = midLng + dLat * offsetScale;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * ctrlLat + t * t * lat2;
    const lng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * ctrlLng + t * t * lng2;
    points.push([lat, lng]);
  }

  return points;
}

export async function fetchOSRMRoute(
  points: { latitude: number; longitude: number }[],
  profile: 'foot' | 'driving' = 'foot'
): Promise<{ coordinates: [number, number][]; distance: number; duration: number; summary: string }> {
  if (!points || points.length < 2) {
    return {
      coordinates: (points || []).map((p) => [p.latitude, p.longitude]),
      distance: 0,
      duration: 0,
      summary: '',
    };
  }

  const coordString = points
    .map((p) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`)
    .join(';');

  const cacheKey = `${profile}_${coordString}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${coordString}?overview=full&geometries=geojson&steps=true`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leafletCoords: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );

        let summaryStr = '';
        if (route.legs && route.legs.length > 0) {
          const names = route.legs
            .map((leg: any) => leg.summary)
            .filter((s: string) => s && s.trim().length > 0);
          if (names.length > 0) {
            summaryStr = `via ${Array.from(new Set(names)).join(' & ')}`;
          }
        }

        const res = {
          coordinates: leafletCoords,
          distance: Math.round(route.distance),
          duration: Math.round(route.duration),
          summary: summaryStr,
        };

        routeCache.set(cacheKey, res);
        return res;
      }
    }
  } catch (err) {
    console.warn('OSRM routing fallback active:', err);
  }

  const fallbackCoords: [number, number][] = [];
  let totalDist = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dist = calculateDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    totalDist += dist;

    const curved = generateCurvedRoadPoints(p1, p2);
    if (i > 0) curved.shift();
    fallbackCoords.push(...curved);
  }

  const fallbackRes = {
    coordinates: fallbackCoords,
    distance: Math.round(totalDist),
    duration: Math.round(totalDist / 1.3),
    summary: 'via Street Route',
  };

  routeCache.set(cacheKey, fallbackRes);
  return fallbackRes;
}

export function calculatePersonPathPrediction(sightings: Sighting[]): PersonPathPrediction | null {
  if (!sightings || sightings.length === 0) return null;

  const validSightings = sightings
    .filter(
      (s) =>
        s &&
        s.location &&
        typeof s.location.latitude === 'number' &&
        typeof s.location.longitude === 'number' &&
        !isNaN(s.location.latitude) &&
        !isNaN(s.location.longitude) &&
        (s.location.latitude !== 0 || s.location.longitude !== 0)
    )
    .sort((a, b) => new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime());

  if (validSightings.length === 0) return null;

  const lastSighting = validSightings[validSightings.length - 1];
  const { key: personKey, name: personName, type: identityType, status } = getPersonKey(lastSighting);

  const observedPoints: PathPoint[] = validSightings.map((s, idx) => ({
    latitude: s.location.latitude,
    longitude: s.location.longitude,
    locationName: s.location?.name || 'Detection Location',
    detectedAt: s.detectedAt,
    sightingId: s._id,
    snapshotUrl: s.snapshotObjectKey,
    sequenceNumber: idx + 1,
  }));

  let totalDistanceMeters = 0;
  for (let i = 1; i < observedPoints.length; i++) {
    totalDistanceMeters += calculateDistance(
      observedPoints[i - 1].latitude,
      observedPoints[i - 1].longitude,
      observedPoints[i].latitude,
      observedPoints[i].longitude
    );
  }

  const startTime = new Date(observedPoints[0].detectedAt).getTime();
  const endTime = new Date(observedPoints[observedPoints.length - 1].detectedAt).getTime();
  const totalDurationSeconds = Math.max(0, (endTime - startTime) / 1000);

  const rawAverageSpeed = totalDurationSeconds > 0 ? (totalDistanceMeters / totalDurationSeconds) * 3.6 : 0;

  let bearingDegrees = 0;
  let rawRecentSpeed = 0;
  let isStationary = false;

  if (observedPoints.length >= 2) {
    const pPrev = observedPoints[observedPoints.length - 2];
    const pLast = observedPoints[observedPoints.length - 1];

    const segmentDistance = calculateDistance(
      pPrev.latitude,
      pPrev.longitude,
      pLast.latitude,
      pLast.longitude
    );

    const segmentDurationSeconds =
      (new Date(pLast.detectedAt).getTime() - new Date(pPrev.detectedAt).getTime()) / 1000;

    if (segmentDistance < 15) {
      isStationary = true;
    }

    bearingDegrees = calculateBearing(
      pPrev.latitude,
      pPrev.longitude,
      pLast.latitude,
      pLast.longitude
    );

    rawRecentSpeed =
      segmentDurationSeconds > 0 ? (segmentDistance / segmentDurationSeconds) * 3.6 : rawAverageSpeed;
  } else {
    isStationary = true;
  }

  const cardinalDir = getCardinalDirection(bearingDegrees);
  const bearingLabel = `${cardinalDir} (${Math.round(bearingDegrees)}°)`;

  // Capped realistic velocity speed calculation (handles test data with 0s time delta)
  let recentSpeedKmH = Math.round(rawRecentSpeed * 10) / 10;
  if (recentSpeedKmH > 100 || recentSpeedKmH <= 0) {
    recentSpeedKmH = 4.5; // Walking speed default
  }

  let averageSpeedKmH = Math.round(rawAverageSpeed * 10) / 10;
  if (averageSpeedKmH > 100 || averageSpeedKmH <= 0) {
    averageSpeedKmH = 4.5;
  }

  let estimatedSpeedMetersPerSec = recentSpeedKmH / 3.6;

  const lastLat = lastSighting.location.latitude;
  const lastLng = lastSighting.location.longitude;
  const lastTimeMs = new Date(lastSighting.detectedAt).getTime();

  const dist15m = estimatedSpeedMetersPerSec * 900;
  const dist30m = estimatedSpeedMetersPerSec * 1800;

  const p15 = projectDestination(lastLat, lastLng, bearingDegrees, dist15m);
  const p30 = projectDestination(lastLat, lastLng, bearingDegrees, dist30m);

  const predictedWaypoints: PredictedWaypoint[] = [
    {
      latitude: p15.latitude,
      longitude: p15.longitude,
      minutesAhead: 15,
      estimatedTime: new Date(lastTimeMs + 15 * 60 * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      label: 'Predicted Position (+15 mins)',
    },
    {
      latitude: p30.latitude,
      longitude: p30.longitude,
      minutesAhead: 30,
      estimatedTime: new Date(lastTimeMs + 30 * 60 * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      label: 'Predicted Trajectory (+30 mins)',
    },
  ];

  const uncertaintyRadiusMeters = Math.max(150, Math.round(dist15m * 0.35));

  let distinctLocationCount = 0;
  if (observedPoints.length >= 2) {
    for (let i = 1; i < observedPoints.length; i++) {
      const d = calculateDistance(
        observedPoints[0].latitude,
        observedPoints[0].longitude,
        observedPoints[i].latitude,
        observedPoints[i].longitude
      );
      if (d > 30) distinctLocationCount++;
    }
  }

  const hasMultipleLocations = observedPoints.length >= 2 && distinctLocationCount > 0;

  return {
    personKey,
    personName,
    identityType,
    status,
    observedPoints,
    hasMultipleLocations,
    totalDistanceMeters: Math.round(totalDistanceMeters),
    totalDurationSeconds,
    averageSpeedKmH,
    recentSpeedKmH,
    bearingDegrees: Math.round(bearingDegrees),
    bearingLabel,
    cardinalDirection: cardinalDir,
    predictedWaypoints,
    uncertaintyRadiusMeters,
    lastSeenTime: new Date(lastSighting.detectedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    lastSeenLocationName: lastSighting.location?.name || 'Last Known Location',
    isStationary,
  };
}

export function getMultiLocationPathPredictions(sightings: Sighting[]): PersonPathPrediction[] {
  if (!sightings || sightings.length === 0) return [];

  const groupedMap = new Map<string, Sighting[]>();

  sightings.forEach((s) => {
    if (!s) return;
    const { key } = getPersonKey(s);
    if (!groupedMap.has(key)) {
      groupedMap.set(key, []);
    }
    groupedMap.get(key)!.push(s);
  });

  const predictions: PersonPathPrediction[] = [];

  groupedMap.forEach((personSightings) => {
    const pred = calculatePersonPathPrediction(personSightings);
    if (pred && pred.hasMultipleLocations) {
      predictions.push(pred);
    }
  });

  return predictions.sort(
    (a, b) =>
      new Date(b.observedPoints[b.observedPoints.length - 1].detectedAt).getTime() -
      new Date(a.observedPoints[a.observedPoints.length - 1].detectedAt).getTime()
  );
}
