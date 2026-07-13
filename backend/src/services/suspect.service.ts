/**
 * suspect.service.ts
 *
 * Core logic for the Unknown-Person → Suspect clustering pipeline.
 *
 * Flow:
 *  1. AI service sends an unknown face detection with its 512-dim embedding.
 *  2. We compare the embedding against all existing suspects using cosine similarity.
 *  3. If similarity ≥ CLUSTER_THRESHOLD → add sighting to existing suspect.
 *  4. If no match → create a new proto-suspect (single sighting).
 *  5. When distinctSources ≥ SUSPECT_THRESHOLD → flag as a real Suspect
 *     with threat level computed from sighting count.
 */

import { Suspect } from '../models/Suspect';
import mongoose from 'mongoose';

const CLUSTER_THRESHOLD  = 0.55;  // cosine similarity to cluster as same person
const SUSPECT_THRESHOLD  = 3;     // distinct sources needed to become a suspect

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom < 1e-9 ? 0 : dot / denom;
}

function computeThreatLevel(distinctSources: number): 'watch' | 'suspicious' | 'high' {
  if (distinctSources >= 7) return 'high';
  if (distinctSources >= 5) return 'suspicious';
  return 'watch';
}

function averageEmbeddings(current: number[], incoming: number[], count: number): number[] {
  // Incremental mean: new_mean = (old_mean * count + new_val) / (count + 1)
  return current.map((v, i) => (v * count + incoming[i]) / (count + 1));
}

export interface UnknownFacePayload {
  embedding: number[];           // 512-dim embedding from AI service
  snapshot: string;              // file path / URL to face crop
  confidence: number;
  sourceType: 'camera' | 'video';
  sourceId?: string;
  sourceName?: string;
  timestamp?: Date;
}

export interface SuspectResult {
  action: 'created' | 'updated' | 'ignored';
  suspectId?: string;
  isNewSuspect?: boolean;     // true when distinctSources just crossed the threshold
  distinctSources?: number;
}

export async function processUnknownFace(payload: UnknownFacePayload): Promise<SuspectResult> {
  const { embedding, snapshot, confidence, sourceType, sourceId, sourceName, timestamp } = payload;
  const now = timestamp || new Date();

  // Load all existing (unresolved) suspects and find best match
  const suspects = await Suspect.find({ isResolved: false });

  let bestMatch: typeof suspects[0] | null = null;
  let bestSim = 0;

  for (const suspect of suspects) {
    if (!suspect.embedding || suspect.embedding.length !== 512) continue;
    const sim = cosineSimilarity(embedding, suspect.embedding);
    if (sim > bestSim && sim >= CLUSTER_THRESHOLD) {
      bestSim = sim;
      bestMatch = suspect;
    }
  }

  const sighting = {
    sourceType,
    sourceId: sourceId ? new mongoose.Types.ObjectId(sourceId) : undefined,
    sourceName,
    snapshot,
    confidence,
    timestamp: now,
  };

  if (bestMatch) {
    // Check if this source is already counted
    const existingSourceIds = bestMatch.sightings
      .map(s => s.sourceId?.toString())
      .filter(Boolean);
    const isNewSource =
      !sourceId || !existingSourceIds.includes(sourceId);

    // Always add the sighting
    bestMatch.sightings.push(sighting);
    bestMatch.lastSeenAt = now;

    // Update embedding with incremental mean
    const prevCount = bestMatch.sightings.length - 1;
    bestMatch.embedding = averageEmbeddings(bestMatch.embedding, embedding, prevCount);

    // Update distinct source count
    if (isNewSource) {
      const uniqueIds = new Set([
        ...existingSourceIds,
        ...(sourceId ? [sourceId] : []),
      ]);
      bestMatch.distinctSources = uniqueIds.size;
    }

    // Update threat level
    bestMatch.threatLevel = computeThreatLevel(bestMatch.distinctSources);

    // Keep best quality snapshot (highest confidence)
    if (confidence > (bestMatch.sightings[0]?.confidence || 0)) {
      bestMatch.representativeSnapshot = snapshot;
    }

    const wasAlreadySuspect = bestMatch.distinctSources >= SUSPECT_THRESHOLD;
    await bestMatch.save();
    const isNewSuspect = !wasAlreadySuspect && bestMatch.distinctSources >= SUSPECT_THRESHOLD;

    return {
      action: 'updated',
      suspectId: bestMatch.suspectId,
      isNewSuspect,
      distinctSources: bestMatch.distinctSources,
    };
  } else {
    // No match — create new proto-suspect entry
    const suspect = await Suspect.create({
      representativeSnapshot: snapshot,
      embedding,
      sightings: [sighting],
      distinctSources: 1,
      threatLevel: 'watch',
      firstSeenAt: now,
      lastSeenAt: now,
    });

    return {
      action: 'created',
      suspectId: suspect.suspectId,
      isNewSuspect: false,
      distinctSources: 1,
    };
  }
}

export async function getAllSuspects(page = 1, limit = 20, onlyFlagged = false) {
  const filter: any = { isResolved: false };
  if (onlyFlagged) {
    filter.distinctSources = { $gte: SUSPECT_THRESHOLD };
  }
  const [suspects, total] = await Promise.all([
    Suspect.find(filter)
      .sort({ distinctSources: -1, lastSeenAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-embedding'), // embedding is large, don't send to frontend
    Suspect.countDocuments(filter),
  ]);
  return { suspects, total };
}

export async function getSuspectById(id: string) {
  return Suspect.findById(id).select('-embedding');
}

export async function resolveSuspect(id: string, notes?: string) {
  return Suspect.findByIdAndUpdate(
    id,
    { isResolved: true, notes },
    { new: true }
  ).select('-embedding');
}

export async function updateSuspectNotes(id: string, notes: string) {
  return Suspect.findByIdAndUpdate(id, { notes }, { new: true }).select('-embedding');
}

export async function getSuspectStats() {
  const [total, flagged, high, bySources] = await Promise.all([
    Suspect.countDocuments({ isResolved: false }),
    Suspect.countDocuments({ isResolved: false, distinctSources: { $gte: SUSPECT_THRESHOLD } }),
    Suspect.countDocuments({ isResolved: false, threatLevel: 'high' }),
    Suspect.aggregate([
      { $match: { isResolved: false } },
      { $group: { _id: '$threatLevel', count: { $sum: 1 } } },
    ]),
  ]);
  return { total, flagged, high, bySources };
}
