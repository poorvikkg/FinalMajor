import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { SightingMap } from '../map/SightingMap';
import api from '../../api';
import type { Sighting } from '../../types';
import { MapPin, Navigation } from 'lucide-react';

const getSnapshotUrl = (pathStr?: string) => {
  if (!pathStr) return '';
  const normalized = pathStr.replace(/\\/g, '/');
  if (normalized.startsWith('http')) return normalized;
  return `/${normalized}`;
};

interface PersonMovementViewProps {
  personId: string;
  personName?: string;
}

export const PersonMovementView: React.FC<PersonMovementViewProps> = ({
  personId,
  personName = 'Subject',
}) => {
  const { data: sightings = [], isLoading } = useQuery<Sighting[]>({
    queryKey: ['personSightings', personId],
    queryFn: async () => {
      const res = await api.get(`/sightings/person/${personId}`);
      return res.data.data || [];
    },
    enabled: !!personId,
  });

  if (isLoading) {
    return (
      <div className="py-12 text-center text-xs text-slate-400 font-mono uppercase tracking-wider">
        Loading movement map and sighting history...
      </div>
    );
  }

  if (sightings.length === 0) {
    return (
      <div className="border border-slate-200 bg-slate-50 rounded-lg p-8 text-center space-y-2 select-none">
        <MapPin className="h-8 w-8 text-slate-400 mx-auto" />
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          No Location Sightings Recorded Yet
        </p>
        <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
          {personName} has not been detected on connected live CCTV streams or analyzed uploaded videos.
        </p>
      </div>
    );
  }

  const firstSighting = sightings[0];
  const lastSighting = sightings[sightings.length - 1];

  return (
    <div className="space-y-4 select-none">
      {/* Sighting Summary Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900 text-white p-3.5 rounded-xl text-xs font-medium">
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Sightings</p>
          <p className="text-base font-bold font-mono text-emerald-400">{sightings.length} Location Spots</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">First Detected</p>
          <p className="text-xs font-bold truncate">📍 {firstSighting.location?.name || 'Unknown'}</p>
          <p className="text-[10px] text-slate-400 font-mono">
            {new Date(firstSighting.detectedAt).toLocaleDateString()} {new Date(firstSighting.detectedAt).toLocaleTimeString()}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Latest Detected</p>
          <p className="text-xs font-bold truncate">📍 {lastSighting.location?.name || 'Unknown'}</p>
          <p className="text-[10px] text-slate-400 font-mono">
            {new Date(lastSighting.detectedAt).toLocaleDateString()} {new Date(lastSighting.detectedAt).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Interactive Movement Map */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
          <span className="flex items-center gap-1.5">
            <Navigation className="h-3.5 w-3.5 text-slate-900" />
            Observed Movement Path & Sighting Map
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            Chronological Sequence (#1 to #{sightings.length})
          </span>
        </div>
        <SightingMap sightings={sightings} height="360px" showSequenceLine={true} />
      </div>

      {/* Chronological Movement Sequence List */}
      <div className="space-y-2 pt-2">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
          Sighting Timeline & Location Logs ({sightings.length})
        </p>

        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
          {sightings.map((sighting, idx) => (
            <div
              key={sighting._id}
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs hover:bg-slate-100/80 transition-colors"
            >
              {/* Sequence Step Badge */}
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold font-mono text-xs shrink-0 shadow-sm">
                #{idx + 1}
              </div>

              {/* Snapshot Thumbnail */}
              {sighting.snapshotObjectKey ? (
                <img
                  src={getSnapshotUrl(sighting.snapshotObjectKey)}
                  alt="Snapshot"
                  className="w-12 h-12 rounded-lg object-cover border border-slate-300 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-bold shrink-0">
                  N/A
                </div>
              )}

              {/* Sighting Details */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900 truncate">
                    📍 {sighting.location?.name || 'Unknown Location'}
                  </p>
                  <span className="font-mono text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    Match: {Math.round(sighting.similarity * 100)}%
                  </span>
                </div>

                <p className="text-slate-500 font-mono text-[11px]">
                  {new Date(sighting.detectedAt).toLocaleString()}
                </p>

                <p className="text-[10px] text-slate-400">
                  Source:{' '}
                  {sighting.sourceType === 'LIVE_CCTV'
                    ? `Live CCTV — ${sighting.cameraId?.name || 'Camera'}`
                    : `Uploaded Video — ${sighting.videoId?.originalName || 'Video File'}`}
                  {sighting.videoTimestampSeconds !== undefined &&
                    ` (Timestamp: ${sighting.videoTimestampSeconds.toFixed(1)}s)`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
