/**
 * SuspectTimeline.tsx
 * Visual chronological timeline of a suspect's movements throughout the city.
 * Calculates interval speed and maps consecutive sightings.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Clock,
  MapPin,
  TrendingUp,
  ArrowLeft,
  Calendar,
  AlertTriangle,
  Zap,
  Activity,
  FileDown,
} from 'lucide-react';
import api from '../../api';

interface TimelineHop {
  _id: string;
  detectedAt: string;
  similarity: number;
  snapshotObjectKey?: string;
  cameraId?: {
    _id: string;
    name: string;
    location?: {
      name: string;
      latitude: number;
      longitude: number;
    } | string;
  };
}

// Haversine distance calculator
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const SuspectTimeline: React.FC = () => {
  const { suspectId } = useParams<{ suspectId: string }>();
  const [searchParams] = useSearchParams();
  const suspectType = searchParams.get('type') || 'UNKNOWN';
  const navigate = useNavigate();

  // Fetch all sightings for this suspect
  const { data: sightings, isLoading } = useQuery({
    queryKey: ['suspect-timeline', suspectId],
    queryFn: async () => {
      const field = suspectType === 'KNOWN' ? 'personId' : 'unknownPersonId';
      const res = await api.get(`/sightings?${field}=${suspectId}&limit=100`);
      const list = res.data.data as TimelineHop[];
      // Sort chronologically
      return list.sort((a, b) => new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime());
    },
  });

  // Calculate speed and gap details between sightings
  const calculatedTimeline = React.useMemo(() => {
    if (!sightings || sightings.length === 0) return [];

    const timelineWithIntervals = [];
    for (let i = 0; i < sightings.length; i++) {
      const current = sightings[i];
      let intervalSpeedKmh = 0;
      let intervalDistanceKm = 0;
      let timeDiffMinutes = 0;

      if (i > 0) {
        const prev = sightings[i - 1];
        const prevLoc = typeof prev.cameraId?.location === 'object' ? prev.cameraId.location as any : null;
        const currLoc = typeof current.cameraId?.location === 'object' ? current.cameraId.location as any : null;

        if (prevLoc && currLoc) {
          intervalDistanceKm = getDistanceKm(
            prevLoc.latitude,
            prevLoc.longitude,
            currLoc.latitude,
            currLoc.longitude
          );
        }

        const prevTime = new Date(prev.detectedAt).getTime();
        const currTime = new Date(current.detectedAt).getTime();
        timeDiffMinutes = (currTime - prevTime) / (1000 * 60);

        if (timeDiffMinutes > 0 && intervalDistanceKm > 0) {
          intervalSpeedKmh = (intervalDistanceKm / (timeDiffMinutes / 60));
        }
      }

      timelineWithIntervals.push({
        ...current,
        intervalSpeedKmh,
        intervalDistanceKm,
        timeDiffMinutes,
      });
    }

    return timelineWithIntervals;
  }, [sightings]);

  const handleExportReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto print:p-0 print:max-w-full">
      {/* Back button and title */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-xs font-bold uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <button
          onClick={handleExportReport}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition-colors"
        >
          <FileDown className="w-4 h-4" />
          Export Timeline Report
        </button>
      </div>

      {/* Header Info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">
                  {suspectType === 'KNOWN' ? 'Registered Subject Timeline' : 'Unknown Sighting Timeline'}
                </h1>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${
                  suspectType === 'KNOWN' ? 'bg-emerald-600' : 'bg-slate-900'
                }`}>
                  {suspectType}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Suspect ID: {suspectId}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center md:text-right">
              <p className="text-2xl font-black text-slate-900">{sightings?.length || 0}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Sightings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <div className="relative border border-slate-200 bg-white rounded-2xl p-6 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 text-xs font-semibold">Compiling chronological timeline...</div>
        ) : !calculatedTimeline || calculatedTimeline.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs font-semibold">No sightings timeline available for this suspect.</div>
        ) : (
          <div className="relative pl-6 space-y-8">
            {/* Vertical timeline connector line */}
            <div className="absolute left-[34px] top-6 bottom-6 w-0.5 bg-slate-100" />

            {calculatedTimeline.map((node, i) => {
              const nodeLoc = typeof node.cameraId?.location === 'object' ? node.cameraId.location as any : null;
              return (
                <div key={node._id} className="relative flex items-start gap-4">
                  {/* Timeline bullet node */}
                  <div className="z-10 flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-slate-900 border-4 border-white flex items-center justify-center shadow-md">
                      <span className="text-[8px] font-black text-white">{i + 1}</span>
                    </div>
                  </div>

                  {/* Sighting card details */}
                  <div className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {node.cameraId?.name || 'Unknown Camera'}
                        </p>
                        <span className="text-[10px] bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded font-mono">
                          Conf: {Math.round(node.similarity * 100)}%
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {nodeLoc?.name || 'Unknown Location'}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(node.detectedAt).toLocaleString()}
                        </p>
                      </div>

                      {/* Movement estimation speed metadata */}
                      {i > 0 && node.intervalDistanceKm > 0 && (
                        <div className="pt-2 flex items-center gap-4 border-t border-slate-200/40">
                          <div className="text-[10px] text-slate-500">
                            Dist: <strong className="text-slate-800">{node.intervalDistanceKm.toFixed(2)} km</strong>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Elapsed: <strong className="text-slate-800">{Math.round(node.timeDiffMinutes)}m</strong>
                          </div>
                          {node.intervalSpeedKmh > 0 && (
                            <div className="text-[10px] text-slate-500">
                              Est Speed:{' '}
                              <strong className={`font-black ${
                                node.intervalSpeedKmh > 40 ? 'text-red-500 animate-pulse' : 'text-slate-800'
                              }`}>
                                {node.intervalSpeedKmh.toFixed(1)} km/h
                              </strong>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Sighting snapshot preview thumbnail */}
                    {node.snapshotObjectKey && (
                      <div className="w-16 h-16 rounded-lg bg-slate-200 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                        <img
                          src={`${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'}/snapshot/${node.snapshotObjectKey}`}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuspectTimeline;
