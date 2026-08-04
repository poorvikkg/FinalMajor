/**
 * analytics.service.ts
 *
 * AI Threat Intelligence Engine + Detection Analytics.
 *
 * Threat Score Formula (0–100):
 *   - appearanceCount × 0.3    (max 30)
 *   - distinctCameraCount × 1  (max 20, capped)
 *   - relayHops × 2            (max 20, capped)
 *   - recentActivity24h × 3    (max 15, capped)
 *   - caseStatusBonus          (0, 5, or 15)
 *   → Threat Level: LOW <30, MEDIUM 30-59, HIGH 60-79, CRITICAL ≥80
 */

import { Types } from 'mongoose';
import { UnknownPerson } from '../models/UnknownPerson';
import { Complaint } from '../models/Complaint';
import { Sighting } from '../models/Sighting';
import { SuspectAlert } from '../models/SuspectAlert';
import { RecognitionLog } from '../models/RecognitionLog';
import { Camera } from '../models/Camera';

export type ThreatLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ThreatScoreResult {
  suspectId: string;
  suspectType: 'KNOWN' | 'UNKNOWN';
  suspectLabel: string;
  snapshotUrl?: string;
  score: number;
  level: ThreatLevel;
  factors: {
    appearances: number;
    cameraSpread: number;
    relayHops: number;
    recentActivity: number;
    caseBonus: number;
  };
  lastSeen?: Date;
  activeAlertId?: string;
}

function computeLevel(score: number): ThreatLevel {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

// ─── Compute threat score for a single unknown person ─────────────────────────
async function scoreUnknown(
  unknown: any,
  recentCount: number,
  alertHops: number
): Promise<ThreatScoreResult> {
  const appearances = Math.min(unknown.appearanceCount || 0, 100);
  const cameraSpread = Math.min(unknown.distinctCameraCount || 0, 20);

  const appearanceScore = (appearances / 100) * 30;
  const cameraScore = Math.min(cameraSpread, 20);
  const relayScore = Math.min(alertHops * 2, 20);
  const recentScore = Math.min(recentCount * 3, 15);

  let caseBonus = 0;
  if (unknown.status === 'REVIEW_REQUIRED') caseBonus = 15;
  else if (unknown.status === 'RECURRING') caseBonus = 5;

  const total = Math.min(
    Math.round(appearanceScore + cameraScore + relayScore + recentScore + caseBonus),
    100
  );

  return {
    suspectId: unknown._id.toString(),
    suspectType: 'UNKNOWN',
    suspectLabel: unknown.unknownId,
    snapshotUrl: unknown.representativeSnapshot,
    score: total,
    level: computeLevel(total),
    factors: {
      appearances: Math.round(appearanceScore),
      cameraSpread: cameraScore,
      relayHops: relayScore,
      recentActivity: recentScore,
      caseBonus,
    },
    lastSeen: unknown.lastSeen,
  };
}

// ─── Compute threat score for a known missing person ────────────────────────
async function scoreKnown(
  complaint: any,
  sightingCount: number,
  cameraCount: number,
  recentCount: number,
  alertHops: number
): Promise<ThreatScoreResult> {
  const appearances = Math.min(sightingCount, 100);
  const cameraSpread = Math.min(cameraCount, 20);

  const appearanceScore = (appearances / 100) * 30;
  const cameraScore = Math.min(cameraSpread, 20);
  const relayScore = Math.min(alertHops * 2, 20);
  const recentScore = Math.min(recentCount * 3, 15);

  // Known missing persons always get a case bonus
  const caseBonus = 15;

  const total = Math.min(
    Math.round(appearanceScore + cameraScore + relayScore + recentScore + caseBonus),
    100
  );

  return {
    suspectId: complaint._id.toString(),
    suspectType: 'KNOWN',
    suspectLabel: complaint.missingPersonName || complaint.complaintId || 'Known Person',
    snapshotUrl: complaint.attachments?.[0],
    score: total,
    level: computeLevel(total),
    factors: {
      appearances: Math.round(appearanceScore),
      cameraSpread: cameraScore,
      relayHops: relayScore,
      recentActivity: recentScore,
      caseBonus,
    },
  };
}

// ─── Get full threat leaderboard ─────────────────────────────────────────────
export async function getThreatLeaderboard(limit = 20): Promise<ThreatScoreResult[]> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Fetch top recurring unknowns
  const unknowns = await UnknownPerson.find({ status: { $in: ['RECURRING', 'REVIEW_REQUIRED'] } })
    .select('-representativeEmbedding')
    .sort({ appearanceCount: -1, distinctCameraCount: -1 })
    .limit(limit)
    .lean();

  // Fetch active relay alerts for hop count lookup
  const activeAlerts = await SuspectAlert.find({ status: 'ACTIVE' })
    .select('unknownPersonId personId relayChain alertId')
    .lean();

  const alertHopsMap = new Map<string, { hops: number; alertId: string }>();
  for (const alert of activeAlerts) {
    const key = alert.unknownPersonId?.toString() || alert.personId?.toString();
    if (key) {
      alertHopsMap.set(key, { hops: alert.relayChain.length, alertId: alert.alertId });
    }
  }

  const results: ThreatScoreResult[] = [];

  for (const unknown of unknowns) {
    const id = unknown._id.toString();
    const recentSightings = await Sighting.countDocuments({
      unknownPersonId: unknown._id,
      detectedAt: { $gte: since24h },
    });
    const alertInfo = alertHopsMap.get(id);
    const score = await scoreUnknown(unknown, recentSightings, alertInfo?.hops || 0);
    if (alertInfo) score.activeAlertId = alertInfo.alertId;
    results.push(score);
  }

  // Fetch complaints with sightings
  const complaints = await Complaint.find({
    status: { $in: ['complaint_registered', 'under_investigation', 'searching_cctv', 'possible_match_found'] },
  })
    .select('missingPersonName complaintId attachments status')
    .sort({ createdAt: -1 })
    .limit(15)
    .lean();

  for (const complaint of complaints) {
    const [sightingCount, cameraCount, recentCount] = await Promise.all([
      Sighting.countDocuments({ personId: complaint._id }),
      Sighting.distinct('cameraId', { personId: complaint._id }).then((ids) => ids.length),
      Sighting.countDocuments({ personId: complaint._id, detectedAt: { $gte: since24h } }),
    ]);

    if (sightingCount === 0 && recentCount === 0) continue; // skip uncorrelated

    const alertInfo = alertHopsMap.get(complaint._id.toString());
    const score = await scoreKnown(complaint, sightingCount, cameraCount, recentCount, alertInfo?.hops || 0);
    if (alertInfo) score.activeAlertId = alertInfo.alertId;
    results.push(score);
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ─── Hourly detection counts (last 24h) ──────────────────────────────────────
export async function getHourlyDetections(): Promise<{ hour: number; count: number; label: string }[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const pipeline = [
    { $match: { detectedAt: { $gte: since } } },
    {
      $group: {
        _id: { $hour: '$detectedAt' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const raw = await (Sighting as any).aggregate(pipeline);
  const hourMap = new Map<number, number>(raw.map((r: any) => [r._id, r.count]));

  const result = [];
  for (let h = 0; h < 24; h++) {
    const label = h === 0 ? '12AM' : h < 12 ? `${h}AM` : h === 12 ? '12PM' : `${h - 12}PM`;
    result.push({ hour: h, count: hourMap.get(h) || 0, label });
  }
  return result;
}

// ─── Detection density for heatmap (lat/lng/weight tuples) ───────────────────
export async function getDetectionHeatmap(): Promise<
  { lat: number; lng: number; weight: number }[]
> {
  const sightings = await Sighting.find({
    'location.locationGeoJson': { $exists: true },
    'location.latitude': { $ne: 0 },
    'location.longitude': { $ne: 0 },
  })
    .select('location.latitude location.longitude similarity')
    .limit(500)
    .lean();

  return sightings.map((s) => ({
    lat: s.location.latitude,
    lng: s.location.longitude,
    weight: s.similarity,
  }));
}

// ─── High-level analytics summary ────────────────────────────────────────────
export async function getAnalyticsSummary() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalSightings,
    sightings24h,
    sightings7d,
    activeAlerts,
    criticalCount,
    highCount,
    camerasOnline,
    totalCameras,
  ] = await Promise.all([
    Sighting.countDocuments(),
    Sighting.countDocuments({ detectedAt: { $gte: since24h } }),
    Sighting.countDocuments({ detectedAt: { $gte: since7d } }),
    SuspectAlert.countDocuments({ status: 'ACTIVE' }),
    // Proxies for threat levels via unknown counts
    UnknownPerson.countDocuments({ status: 'REVIEW_REQUIRED' }),
    UnknownPerson.countDocuments({ status: 'RECURRING' }),
    Camera.countDocuments({ status: 'online' }),
    Camera.countDocuments(),
  ]);

  return {
    totalSightings,
    sightings24h,
    sightings7d,
    activeAlerts,
    threatCounts: {
      critical: criticalCount,
      high: highCount,
    },
    cameraHealth: {
      online: camerasOnline,
      total: totalCameras,
      healthPct: totalCameras > 0 ? Math.round((camerasOnline / totalCameras) * 100) : 0,
    },
  };
}

// ─── Predict next cameras based on relay chain trajectory ────────────────────
export async function predictNextCameras(
  alertId: string
): Promise<{ cameras: any[]; bearingDeg: number; predictedLat: number; predictedLng: number } | null> {
  const alert = await SuspectAlert.findOne({ alertId }).lean();
  if (!alert || alert.relayChain.length < 2) return null;

  const chain = alert.relayChain;
  const last = chain[chain.length - 1];
  const prev = chain[chain.length - 2];

  // Compute bearing (direction of movement)
  const dLng = last.longitude - prev.longitude;
  const dLat = last.latitude - prev.latitude;
  const bearingRad = Math.atan2(dLng, dLat);
  const bearingDeg = ((bearingRad * 180) / Math.PI + 360) % 360;

  // Project 800m ahead in the direction of movement
  const R = 6371000;
  const dist = 800; // meters
  const lat1 = (last.latitude * Math.PI) / 180;
  const lng1 = (last.longitude * Math.PI) / 180;
  const bearing = bearingRad;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dist / R) + Math.cos(lat1) * Math.sin(dist / R) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(dist / R) * Math.cos(lat1),
      Math.cos(dist / R) - Math.sin(lat1) * Math.sin(lat2)
    );

  const predictedLat = (lat2 * 180) / Math.PI;
  const predictedLng = (lng2 * 180) / Math.PI;

  // Find cameras near the predicted point
  const cameras = await Camera.find({
    isActive: true,
    'location.locationGeoJson': {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: [predictedLng, predictedLat] },
        $maxDistance: 600, // 600m radius around prediction
      },
    },
    _id: { $nin: alert.confirmedCameraIds },
  })
    .select('_id name location status')
    .limit(3)
    .lean();

  return { cameras, bearingDeg, predictedLat, predictedLng };
}
