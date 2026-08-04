/**
 * accomplice.service.ts
 *
 * Core algorithm for Accomplice Detection / Link Analysis.
 * Scans historical sightings, matching pairs of different suspects who appeared at
 * the same camera or in close spatial proximity within a configurable time window.
 */

import { Types } from 'mongoose';
import { Sighting } from '../models/Sighting';
import { Complaint } from '../models/Complaint';
import { UnknownPerson } from '../models/UnknownPerson';

export interface LinkAnalysisOptions {
  timeWindowSeconds?: number;
  distanceThresholdMeters?: number;
  minCoOccurrences?: number;
  startDate?: string;
  endDate?: string;
  targetId?: string; // Optional filter to focus on a specific person
}

export interface AccompliceNode {
  id: string; // "person:<id>" or "unknown:<id>"
  name: string;
  type: 'KNOWN' | 'UNKNOWN';
  snapshot: string;
  status: string;
}

export interface CoOccurrenceDetail {
  timestamp: Date;
  locationName: string;
  cameraId?: string;
  cameraName?: string;
  timeDifferenceSeconds: number;
  sightingA: {
    id: string;
    detectedAt: Date;
    snapshot: string;
    similarity: number;
    videoName?: string;
  };
  sightingB: {
    id: string;
    detectedAt: Date;
    snapshot: string;
    similarity: number;
    videoName?: string;
  };
}

export interface AccompliceLink {
  source: string; // node ID
  target: string; // node ID
  value: number; // weight (number of co-occurrences)
  coOccurrences: CoOccurrenceDetail[];
}

export interface LinkAnalysisResult {
  nodes: AccompliceNode[];
  links: AccompliceLink[];
}

/**
 * Calculates the Haversine distance between two coordinates in meters.
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // meters
}

/**
 * Resolves a suspect reference to a unique string ID and human readable details.
 */
function getSuspectInfo(sighting: any): { key: string; name: string; type: 'KNOWN' | 'UNKNOWN'; snapshot: string; status: string } | null {
  if (sighting.personId) {
    const p = sighting.personId;
    return {
      key: `person:${p._id || p}`,
      name: p.missingPersonName || p.complaintId || 'Known Person',
      type: 'KNOWN',
      snapshot: p.attachments?.[0] || '',
      status: p.status || 'Active',
    };
  } else if (sighting.unknownPersonId) {
    const u = sighting.unknownPersonId;
    return {
      key: `unknown:${u._id || u}`,
      name: u.unknownId || 'Unknown Person',
      type: 'UNKNOWN',
      snapshot: u.representativeSnapshot || '',
      status: u.status || 'Recurring',
    };
  }
  return null;
}

export async function getLinkAnalysis(options: LinkAnalysisOptions): Promise<LinkAnalysisResult> {
  const timeWindow = options.timeWindowSeconds || 120;
  const distanceThreshold = options.distanceThresholdMeters || 50;
  const minCoOccurrences = options.minCoOccurrences || 1;

  const query: Record<string, any> = {};

  if (options.startDate || options.endDate) {
    query.detectedAt = {};
    if (options.startDate) query.detectedAt.$gte = new Date(options.startDate);
    if (options.endDate) query.detectedAt.$lte = new Date(options.endDate);
  }

  // Ensure sighting contains an identity
  query.$or = [{ personId: { $ne: null } }, { unknownPersonId: { $ne: null } }];

  let targetObjectId: Types.ObjectId | null = null;
  let targetType: 'KNOWN' | 'UNKNOWN' | null = null;

  if (options.targetId) {
    if (Types.ObjectId.isValid(options.targetId)) {
      targetObjectId = new Types.ObjectId(options.targetId);
      // Determine target identity type from existing sightings
      const sample = await Sighting.findOne({
        $or: [{ personId: targetObjectId }, { unknownPersonId: targetObjectId }],
      }).lean();
      if (sample) {
        if (sample.personId && sample.personId.toString() === options.targetId) {
          targetType = 'KNOWN';
        } else {
          targetType = 'UNKNOWN';
        }
      }
    }
  }

  let sightings: any[] = [];

  if (targetObjectId) {
    // Optimized target-focused lookup:
    // First, fetch the target's sightings
    const targetQuery: any = { ...query };
    if (targetType === 'KNOWN') {
      targetQuery.personId = targetObjectId;
    } else {
      targetQuery.unknownPersonId = targetObjectId;
    }

    const targetSightings = await Sighting.find(targetQuery)
      .populate('cameraId', 'name location')
      .lean();

    if (targetSightings.length === 0) {
      return { nodes: [], links: [] };
    }

    // Next, build OR queries to fetch other suspects seen at same camera or close proximity within the time range
    const orConditions: any[] = [];
    for (const ts of targetSightings) {
      const tMin = new Date(ts.detectedAt.getTime() - timeWindow * 1000);
      const tMax = new Date(ts.detectedAt.getTime() + timeWindow * 1000);

      const baseCond: any = {
        detectedAt: { $gte: tMin, $lte: tMax },
        personId: { $ne: targetObjectId },
        unknownPersonId: { $ne: targetObjectId },
      };

      if (ts.cameraId) {
        orConditions.push({
          ...baseCond,
          cameraId: ts.cameraId._id || ts.cameraId,
        });
      } else if (ts.location && ts.location.latitude && ts.location.longitude) {
        orConditions.push({
          ...baseCond,
          'location.locationGeoJson': {
            $nearSphere: {
              $geometry: {
                type: 'Point',
                coordinates: [ts.location.longitude, ts.location.latitude],
              },
              $maxDistance: distanceThreshold,
            },
          },
        });
      }
    }

    if (orConditions.length > 0) {
      const coSightings = await Sighting.find({ $or: orConditions })
        .populate('personId', 'missingPersonName complaintId attachments status')
        .populate('unknownPersonId', 'unknownId status representativeSnapshot')
        .populate('cameraId', 'name location')
        .populate('videoId', 'originalName filename')
        .lean();

      // Retrieve full target details for coSightings integration
      const fullTargetSightings = await Sighting.find(targetQuery)
        .populate('personId', 'missingPersonName complaintId attachments status')
        .populate('unknownPersonId', 'unknownId status representativeSnapshot')
        .populate('cameraId', 'name location')
        .populate('videoId', 'originalName filename')
        .lean();

      sightings = [...fullTargetSightings, ...coSightings];
    } else {
      sightings = [];
    }
  } else {
    // Global analysis: retrieve last 5000 sightings
    sightings = await Sighting.find(query)
      .populate('personId', 'missingPersonName complaintId attachments status')
      .populate('unknownPersonId', 'unknownId status representativeSnapshot')
      .populate('cameraId', 'name location')
      .populate('videoId', 'originalName filename')
      .limit(5000)
      .lean();
  }

  // Sort sightings chronologically for sliding window
  sightings.sort((a, b) => a.detectedAt.getTime() - b.detectedAt.getTime());

  const linksMap = new Map<string, AccompliceLink>();
  const nodesMap = new Map<string, AccompliceNode>();

  // Process sliding window co-occurrences
  for (let i = 0; i < sightings.length; i++) {
    const sI = sightings[i];
    const infoI = getSuspectInfo(sI);
    if (!infoI) continue;

    for (let j = i + 1; j < sightings.length; j++) {
      const sJ = sightings[j];
      const infoJ = getSuspectInfo(sJ);
      if (!infoJ) continue;

      // Check if it's the same suspect
      if (infoI.key === infoJ.key) continue;

      // Calculate time gap
      const timeDiffSeconds = Math.abs(sJ.detectedAt.getTime() - sI.detectedAt.getTime()) / 1000;
      if (timeDiffSeconds > timeWindow) {
        break; // Since sorted chronologically, subsequent ones are further in future
      }

      // Check spatial match
      let isCoOccurred = false;
      let locName = '';
      let camIdStr = '';
      let camNameStr = '';

      const camI = sI.cameraId;
      const camJ = sJ.cameraId;

      if (camI && camJ && camI._id.toString() === camJ._id.toString()) {
        isCoOccurred = true;
        locName = camI.name || sI.location?.name || 'CCTV Camera';
        camIdStr = camI._id.toString();
        camNameStr = camI.name || '';
      } else if (
        sI.location && sI.location.latitude && sI.location.longitude &&
        sJ.location && sJ.location.latitude && sJ.location.longitude
      ) {
        const dist = getDistance(
          sI.location.latitude,
          sI.location.longitude,
          sJ.location.latitude,
          sJ.location.longitude
        );
        if (dist <= distanceThreshold) {
          isCoOccurred = true;
          locName = `Spatial Proximity (${Math.round(dist)}m)`;
        }
      }

      if (isCoOccurred) {
        const sortedKeys = [infoI.key, infoJ.key].sort();
        const linkKey = `${sortedKeys[0]}_${sortedKeys[1]}`;

        // Ensure both nodes are tracked
        nodesMap.set(infoI.key, {
          id: infoI.key,
          name: infoI.name,
          type: infoI.type,
          snapshot: infoI.snapshot,
          status: infoI.status,
        });

        nodesMap.set(infoJ.key, {
          id: infoJ.key,
          name: infoJ.name,
          type: infoJ.type,
          snapshot: infoJ.snapshot,
          status: infoJ.status,
        });

        const detail: CoOccurrenceDetail = {
          timestamp: sI.detectedAt,
          locationName: locName,
          cameraId: camIdStr || undefined,
          cameraName: camNameStr || undefined,
          timeDifferenceSeconds: timeDiffSeconds,
          sightingA: {
            id: sI._id.toString(),
            detectedAt: sI.detectedAt,
            snapshot: sI.snapshotObjectKey || infoI.snapshot,
            similarity: sI.similarity,
            videoName: sI.videoId?.originalName || sI.videoId?.filename,
          },
          sightingB: {
            id: sJ._id.toString(),
            detectedAt: sJ.detectedAt,
            snapshot: sJ.snapshotObjectKey || infoJ.snapshot,
            similarity: sJ.similarity,
            videoName: sJ.videoId?.originalName || sJ.videoId?.filename,
          },
        };

        const existing = linksMap.get(linkKey);
        if (existing) {
          existing.value += 1;
          existing.coOccurrences.push(detail);
        } else {
          linksMap.set(linkKey, {
            source: sortedKeys[0],
            target: sortedKeys[1],
            value: 1,
            coOccurrences: [detail],
          });
        }
      }
    }
  }

  // Filter links by minimum co-occurrences threshold
  const filteredLinks = Array.from(linksMap.values()).filter(
    (link) => link.value >= minCoOccurrences
  );

  let finalNodes: AccompliceNode[] = [];
  let finalLinks: AccompliceLink[] = [];

  if (targetObjectId) {
    const targetKey = targetType === 'KNOWN' ? `person:${targetObjectId}` : `unknown:${targetObjectId}`;

    // Extract connected component (BFS up to 2 degrees)
    const visited = new Set<string>([targetKey]);
    const queue = [targetKey];
    let degrees = 0;
    const maxDegrees = 2;

    const adj = new Map<string, Set<string>>();
    for (const l of filteredLinks) {
      if (!adj.has(l.source)) adj.set(l.source, new Set());
      if (!adj.has(l.target)) adj.set(l.target, new Set());
      adj.get(l.source)!.add(l.target);
      adj.get(l.target)!.add(l.source);
    }

    while (queue.length > 0 && degrees < maxDegrees) {
      const size = queue.length;
      for (let i = 0; i < size; i++) {
        const cur = queue.shift()!;
        const neighbors = adj.get(cur);
        if (neighbors) {
          for (const n of neighbors) {
            if (!visited.has(n)) {
              visited.add(n);
              queue.push(n);
            }
          }
        }
      }
      degrees++;
    }

    finalLinks = filteredLinks.filter((l) => visited.has(l.source) && visited.has(l.target));
    finalNodes = Array.from(nodesMap.values()).filter((n) => visited.has(n.id));

    // Guarantee the target node is present
    if (!visited.has(targetKey) || !nodesMap.has(targetKey)) {
      if (targetType === 'KNOWN') {
        const c = await Complaint.findById(targetObjectId).lean();
        if (c) {
          finalNodes.push({
            id: targetKey,
            name: c.missingPersonName || c.complaintId || 'Known Person',
            type: 'KNOWN',
            snapshot: c.attachments?.[0] || '',
            status: c.status || 'Active',
          });
        }
      } else {
        const u = await UnknownPerson.findById(targetObjectId).lean();
        if (u) {
          finalNodes.push({
            id: targetKey,
            name: u.unknownId || 'Unknown Person',
            type: 'UNKNOWN',
            snapshot: u.representativeSnapshot || '',
            status: u.status || 'Recurring',
          });
        }
      }
    }
  } else {
    // Keep nodes referenced in final links
    const activeNodeKeys = new Set<string>();
    for (const l of filteredLinks) {
      activeNodeKeys.add(l.source);
      activeNodeKeys.add(l.target);
    }
    finalNodes = Array.from(nodesMap.values()).filter((n) => activeNodeKeys.has(n.id));
    finalLinks = filteredLinks;
  }

  return {
    nodes: finalNodes,
    links: finalLinks,
  };
}
