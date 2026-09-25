import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { SightingMap } from '../../components/map/SightingMap';
import api from '../../api';
import { socket } from '../../socket';
import type { Sighting, SightingIdentityType, SightingSourceType } from '../../types';
import {
  getMultiLocationPathPredictions,
  getSnapshotUrl,
} from '../../utils/pathPrediction';
import type { PersonPathPrediction } from '../../utils/pathPrediction';

import {
  MapPin,
  Search,
  UserSearch,
  Navigation,
  Target,
  Activity,
  Layers,
  Play,
  Pause,
  SkipBack,
  Flame,
  Clock,
  Radio,
} from 'lucide-react';


/* ─────────────────────── Main Page ─────────────────────── */

export function DetectionMapPage() {
  const [page] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [identityFilter, setIdentityFilter] = useState<'ALL' | SightingIdentityType>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | SightingSourceType>('ALL');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSighting, setSelectedSighting] = useState<Sighting | null>(null);

  // Path / Trajectory
  const [showPredictivePath, setShowPredictivePath] = useState(true);
  const [activePathPersonKey, setActivePathPersonKey] = useState<string>('ALL');
  const [isTriggeringCorridor, setIsTriggeringCorridor] = useState(false);
  const [triggerStatusMessage, setTriggerStatusMessage] = useState<string | null>(null);

  // Advanced Map Controls
  const [mapLayer, setMapLayer] = useState<'standard' | 'dark' | 'satellite'>('standard');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showClusters, setShowClusters] = useState(true);
  const [activeTab, setActiveTab] = useState<'filters' | 'trajectory' | 'timeline'>('filters');

  // Timeline Playback
  const [timelineIndex, setTimelineIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const queryClient = useQueryClient();

  const { data: complaints = [] } = useQuery({
    queryKey: ['complaintsDropdownList'],
    queryFn: async () => {
      try {
        const res = await api.get('/complaints?limit=200&allStations=true');
        return res.data.data || [];
      } catch {
        return [];
      }
    },
  });

  const { data } = useQuery({
    queryKey: ['sightings', page, identityFilter, sourceFilter, selectedPersonId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ page: page.toString(), limit: '200' });
      if (identityFilter !== 'ALL') params.append('identityType', identityFilter);
      if (sourceFilter !== 'ALL') params.append('sourceType', sourceFilter);
      if (selectedPersonId) params.append('personId', selectedPersonId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const res = await api.get(`/sightings?${params.toString()}`);
      return res.data;
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    const handleNewSighting = (newSighting: Sighting) => {
      queryClient.setQueryData(
        ['sightings', page, identityFilter, sourceFilter, startDate, endDate],
        (oldData: any) => {
          if (!oldData) return oldData;
          return { ...oldData, data: [newSighting, ...(oldData.data || [])] };
        }
      );
    };
    socket.on('sighting:new', handleNewSighting);
    return () => { socket.off('sighting:new', handleNewSighting); };
  }, [queryClient, page, identityFilter, sourceFilter, startDate, endDate]);

  const rawSightings: Sighting[] = data?.data || [];

  const filteredSightings = rawSightings.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const personName = (typeof s.personId === 'object' && s.personId !== null ? s.personId.missingPersonName : '')?.toLowerCase() || '';
    const complaintId = (typeof s.personId === 'object' && s.personId !== null ? s.personId.complaintId : '')?.toLowerCase() || '';
    const unknownId = (typeof s.unknownPersonId === 'object' && s.unknownPersonId !== null ? s.unknownPersonId.unknownId : '')?.toLowerCase() || '';
    const locName = s.location?.name?.toLowerCase() || '';
    return personName.includes(q) || complaintId.includes(q) || unknownId.includes(q) || locName.includes(q);
  });

  // Timeline: sorted sightings for playback
  const timelineSightings = useMemo(() =>
    [...filteredSightings].sort((a, b) => new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime()),
    [filteredSightings]
  );

  // Active sightings shown on map (may be subset during playback)
  const visibleSightings = useMemo(() => {
    if (timelineIndex === null) return filteredSightings;
    return timelineSightings.slice(0, timelineIndex + 1);
  }, [filteredSightings, timelineSightings, timelineIndex]);

  // Timeline playback
  const startPlayback = useCallback(() => {
    if (timelineSightings.length === 0) return;
    const startIdx = timelineIndex === null || timelineIndex >= timelineSightings.length - 1 ? 0 : timelineIndex;
    setTimelineIndex(startIdx);
    setIsPlaying(true);
  }, [timelineSightings.length, timelineIndex]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      return;
    }
    playIntervalRef.current = setInterval(() => {
      setTimelineIndex((prev) => {
        const next = (prev ?? -1) + 1;
        if (next >= timelineSightings.length - 1) {
          setIsPlaying(false);
          return timelineSightings.length - 1;
        }
        return next;
      });
    }, 600);
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, timelineSightings.length]);

  // Trajectory
  const multiLocationPredictions = useMemo(() =>
    getMultiLocationPathPredictions(visibleSightings),
    [visibleSightings]
  );

  const activePrediction: PersonPathPrediction | null = useMemo(() => {
    if (multiLocationPredictions.length === 0) return null;
    if (activePathPersonKey === 'ALL' || !activePathPersonKey) return multiLocationPredictions[0];
    return multiLocationPredictions.find((p) => p.personKey === activePathPersonKey) || multiLocationPredictions[0];
  }, [multiLocationPredictions, activePathPersonKey]);

  const handleAutoTriggerCorridor = async () => {
    if (!activePrediction) return;
    setIsTriggeringCorridor(true);
    setTriggerStatusMessage(null);
    try {
      const points = [
        ...activePrediction.observedPoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
        ...(activePrediction.predictedWaypoints || []).map((w) => ({ latitude: w.latitude, longitude: w.longitude })),
      ];
      const targetUserId = activePrediction.identityType === 'KNOWN'
        ? activePrediction.personKey.replace('known_', '')
        : undefined;
      const res = await api.post('/cameras/auto-trigger-corridor', {
        points, radiusMeters: 2000, target_user_id: targetUserId,
      });
      const count = res.data?.data?.triggeredCount || 0;
      setTriggerStatusMessage(`Auto-triggered ${count} CCTV stream(s) along suspect's movement corridor.`);
    } catch (err: any) {
      setTriggerStatusMessage(`Auto-trigger failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsTriggeringCorridor(false);
    }
  };

  const mapTileUrl = useMemo(() => {
    if (mapLayer === 'dark') return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    if (mapLayer === 'satellite') return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  }, [mapLayer]);

  /* ─── RENDER ─── */
  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50">

      {/* ── LEFT SIDEBAR ── */}
      <div className="w-[360px] border-r border-slate-200 bg-white flex flex-col h-full overflow-hidden flex-shrink-0">

        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-900 text-white rounded-lg">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Detection Map</h2>
              <p className="text-[9px] text-slate-500 font-mono">{filteredSightings.length} sightings loaded</p>
            </div>
          </div>
          {/* Live pulse */}
          <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </span>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-slate-200 shrink-0 bg-white">
          {(['filters', 'trajectory', 'timeline'] as const).map((tab) => {
            const icons = {
              filters: <Search className="h-3 w-3" />,
              trajectory: <Navigation className="h-3 w-3" />,
              timeline: <Clock className="h-3 w-3" />,
            };
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'text-slate-900 border-b-2 border-slate-900 bg-white'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                {icons[tab]}
                {tab}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div className="flex-grow overflow-y-auto p-3 space-y-3">

          {/* ── FILTERS TAB ── */}
          {activeTab === 'filters' && (
            <div className="space-y-3">
              {/* Map Layer Switcher */}
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="h-3 w-3" /> Map Layer
                </p>
                <div className="flex gap-1.5">
                  {(['standard', 'dark', 'satellite'] as const).map((layer) => (
                    <button
                      key={layer}
                      type="button"
                      onClick={() => setMapLayer(layer)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${
                        mapLayer === layer ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      {layer}
                    </button>
                  ))}
                </div>

                {/* Overlay toggles */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      showHeatmap ? 'bg-red-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    <Flame className="h-3 w-3" /> Heatmap
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClusters(!showClusters)}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      showClusters ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    <Target className="h-3 w-3" /> Clusters
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Filters</p>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Identity Type</label>
                  <select
                    value={identityFilter}
                    onChange={(e) => setIdentityFilter(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                  >
                    <option value="ALL">All Identities</option>
                    <option value="KNOWN">Registered Persons</option>
                    <option value="UNKNOWN">Recurring Unknowns</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Registered Person</label>
                  <select
                    value={selectedPersonId}
                    onChange={(e) => {
                      setSelectedPersonId(e.target.value);
                      if (e.target.value) setIdentityFilter('KNOWN');
                    }}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white text-slate-800"
                  >
                    <option value="">— All Persons —</option>
                    {complaints
                      .filter((c: any) => c._id && c.missingPersonName)
                      .map((c: any) => (
                        <option key={c._id} value={c._id}>
                          {c.missingPersonName} ({c.complaintId || 'Case'})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Detection Source</label>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value as any)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white text-slate-800"
                  >
                    <option value="ALL">All Sources</option>
                    <option value="LIVE_CCTV">Live CCTV</option>
                    <option value="UPLOADED_VIDEO">Uploaded Videos</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">From</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-[11px] p-2 rounded-lg border border-slate-200 bg-white" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">To</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-[11px] p-2 rounded-lg border border-slate-200 bg-white" />
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, complaint, location..."
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-xs border border-slate-200 bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── TRAJECTORY TAB ── */}
          {activeTab === 'trajectory' && (
            <div className="space-y-3">
              {/* Status message */}
              {triggerStatusMessage && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-semibold flex items-start justify-between gap-2">
                  <span>{triggerStatusMessage}</span>
                  <button type="button" onClick={() => setTriggerStatusMessage(null)} className="text-amber-700 shrink-0">✕</button>
                </div>
              )}

              {multiLocationPredictions.length > 0 ? (
                <div className="space-y-3">
                  {/* Subject Selector */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active Subjects</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActivePathPersonKey('ALL')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          activePathPersonKey === 'ALL' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        All ({multiLocationPredictions.length})
                      </button>
                      {multiLocationPredictions.map((pred) => (
                        <button
                          key={pred.personKey}
                          type="button"
                          onClick={() => setActivePathPersonKey(pred.personKey)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            activePathPersonKey === pred.personKey ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${pred.identityType === 'KNOWN' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {pred.personName.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {activePrediction && (
                      <button
                        type="button"
                        onClick={handleAutoTriggerCorridor}
                        disabled={isTriggeringCorridor}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 text-white font-bold text-[10px] shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Radio className="h-3 w-3" />
                        {isTriggeringCorridor ? 'Scanning...' : 'Trigger Cameras'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPredictivePath(!showPredictivePath)}
                      className={`flex-1 px-3 py-2 rounded-xl border text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        showPredictivePath ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      <Navigation className="h-3 w-3" />
                      {showPredictivePath ? 'Hide Path' : 'Show Path'}
                    </button>
                  </div>

                  {/* Active Prediction Metrics */}
                  {activePrediction && (
                    <div className="space-y-2">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Subject</p>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                            activePrediction.identityType === 'KNOWN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {activePrediction.identityType}
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 text-xs truncate">{activePrediction.personName}</p>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-bold">Sightings</p>
                            <p className="font-bold text-slate-900 text-sm">{activePrediction.observedPoints.length}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-bold">Distance</p>
                            <p className="font-bold text-slate-900 text-sm">{(activePrediction.totalDistanceMeters / 1000).toFixed(2)} km</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-bold">Heading</p>
                            <p className="font-bold text-slate-900 text-xs">{activePrediction.bearingLabel}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-bold">Speed</p>
                            <p className="font-bold text-slate-900 text-sm">{activePrediction.recentSpeedKmH} km/h</p>
                          </div>
                        </div>
                      </div>

                      {/* Predicted Destination */}
                      <div className="bg-indigo-950 text-white p-3 rounded-xl space-y-1.5">
                        <p className="text-[9px] font-bold text-indigo-300 uppercase flex items-center gap-1">
                          <Target className="h-3 w-3" /> Projected Destination
                        </p>
                        <p className="font-bold text-white text-xs">
                          ETA +15m: {activePrediction.predictedWaypoints[0]?.estimatedTime || 'N/A'}
                        </p>
                        <p className="font-mono text-[9px] text-indigo-300">
                          {activePrediction.predictedWaypoints[0]?.latitude.toFixed(5)}, {activePrediction.predictedWaypoints[0]?.longitude.toFixed(5)}
                        </p>
                        <p className="text-[9px] text-indigo-400">Last seen: {activePrediction.lastSeenLocationName}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-center">
                  <Navigation className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-[11px] text-slate-500 font-medium">No multi-location trajectories detected</p>
                  <p className="text-[10px] text-slate-400 mt-1">Need ≥2 distinct sightings per subject</p>
                </div>
              )}
            </div>
          )}

          {/* ── ANALYTICS TAB ── */}
          {activeTab === 'analytics' && (
            <div className="space-y-3">
              {timeAnalytics ? (
                <>
                  {/* Risk Assessment */}
                  {riskAssessment && (
                    <div className={`p-3 rounded-xl border ${riskAssessment.bg} space-y-1.5`}>
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                          <Shield className="h-3 w-3" /> Risk Assessment
                        </p>
                        <span className={`text-[10px] font-black ${riskAssessment.color} px-2 py-0.5 rounded font-mono`}>
                          {riskAssessment.level}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden border border-white/40">
                          <div
                            className={`h-full rounded-full transition-all ${
                              riskAssessment.level === 'CRITICAL' ? 'bg-red-600' :
                              riskAssessment.level === 'HIGH' ? 'bg-orange-500' :
                              riskAssessment.level === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(riskAssessment.score, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold font-mono">{Math.min(riskAssessment.score, 100)}/100</span>
                      </div>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard
                      icon={<Eye className="h-3.5 w-3.5" />}
                      label="Total Sightings"
                      value={timeAnalytics.total}
                      accent="bg-slate-900"
                    />
                    <StatCard
                      icon={<MapPin className="h-3.5 w-3.5" />}
                      label="Unique Locations"
                      value={timeAnalytics.uniqueLocations}
                      accent="bg-indigo-700"
                    />
                    <StatCard
                      icon={<Activity className="h-3.5 w-3.5" />}
                      label="Known Subjects"
                      value={timeAnalytics.knownCount}
                      sub={`${timeAnalytics.unknownCount} unknown`}
                      accent="bg-emerald-700"
                    />
                    <StatCard
                      icon={<TrendingUp className="h-3.5 w-3.5" />}
                      label="Time Span"
                      value={timeAnalytics.spanHours < 1 ? `${Math.round(timeAnalytics.spanHours * 60)}m` : `${timeAnalytics.spanHours.toFixed(1)}h`}
                      sub={`Avg gap: ${Math.round(timeAnalytics.avgInterval)}m`}
                      accent="bg-violet-700"
                    />
                  </div>

                  {/* Peak Activity */}
                  {timeAnalytics.peakHour && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Peak Activity Window
                      </p>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="font-black text-slate-900 text-lg leading-tight">
                            {String(timeAnalytics.peakHour[0]).padStart(2, '0')}:00
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {timeAnalytics.peakHour[1]} detections in this hour
                          </p>
                        </div>
                        <AlertTriangle className="h-6 w-6 text-amber-400" />
                      </div>
                    </div>
                  )}

                  {/* Hotspot Analysis */}
                  <div className="space-y-1.5">
                    <SectionHeader
                      title="Hotspot Clusters"
                      count={hotspots.length}
                      expanded={sectionsOpen.hotspots}
                      onToggle={() => toggleSection('hotspots')}
                    />
                    {sectionsOpen.hotspots && (
                      <div className="space-y-1.5">
                        {hotspots.slice(0, 5).map((hs, i) => (
                          <div key={i} className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0 ${
                              i === 0 ? 'bg-red-600' : i === 1 ? 'bg-orange-500' : i === 2 ? 'bg-amber-500' : 'bg-slate-600'
                            }`}>
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">{hs.locationName}</p>
                              <p className="text-[9px] text-slate-500 font-mono">
                                {hs.count} detections · {hs.knownCount}K / {hs.unknownCount}U
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-slate-900 text-sm">{hs.count}</p>
                            </div>
                          </div>
                        ))}
                        {hotspots.length === 0 && (
                          <p className="text-[10px] text-slate-400 text-center py-2">No clusters found</p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-center">
                  <BarChart3 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-[11px] text-slate-500 font-medium">No data to analyze</p>
                </div>
              )}
            </div>
          )}

          {/* ── TIMELINE TAB ── */}
          {activeTab === 'timeline' && (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Timeline Playback
                </p>

                {timelineSightings.length > 0 ? (
                  <>
                    {/* Playback controls */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setTimelineIndex(null); setIsPlaying(false); }}
                        className="p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                        title="Reset"
                      >
                        <SkipBack className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => isPlaying ? stopPlayback() : startPlayback()}
                        className={`flex-1 py-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          isPlaying ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
                        }`}
                      >
                        {isPlaying ? <><Pause className="h-3.5 w-3.5" /> Stop</> : <><Play className="h-3.5 w-3.5" /> Play</>}
                      </button>
                    </div>

                    {/* Scrubber */}
                    <div className="space-y-1">
                      <input
                        type="range"
                        min={0}
                        max={timelineSightings.length - 1}
                        value={timelineIndex ?? timelineSightings.length - 1}
                        onChange={(e) => {
                          stopPlayback();
                          setTimelineIndex(Number(e.target.value));
                        }}
                        className="w-full accent-slate-900 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] font-mono text-slate-400">
                        <span>{timelineSightings.length > 0 ? new Date(timelineSightings[0].detectedAt).toLocaleDateString() : ''}</span>
                        <span className="font-bold text-slate-700">
                          {timelineIndex !== null ? `#${timelineIndex + 1} / ${timelineSightings.length}` : `All ${timelineSightings.length}`}
                        </span>
                        <span>{timelineSightings.length > 0 ? new Date(timelineSightings[timelineSightings.length - 1].detectedAt).toLocaleDateString() : ''}</span>
                      </div>
                    </div>

                    {/* Current frame info */}
                    {timelineIndex !== null && timelineSightings[timelineIndex] && (() => {
                      const current = timelineSightings[timelineIndex];
                      const label = current.identityType === 'KNOWN'
                        ? (typeof current.personId === 'object' && current.personId !== null ? current.personId.missingPersonName : 'Known Subject') || 'Known Subject'
                        : (typeof current.unknownPersonId === 'object' && current.unknownPersonId !== null ? current.unknownPersonId.unknownId : 'Unknown Subject') || 'Unknown Subject';
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-lg space-y-1">
                          <p className="text-[9px] text-slate-400 uppercase font-bold">Current Frame</p>
                          <p className="font-bold text-sm truncate">{label}</p>
                          <p className="text-[10px] text-slate-300 font-mono">{new Date(current.detectedAt).toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400">{current.location?.name}</p>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <p className="text-[10px] text-slate-400 text-center py-3">No sightings to play back</p>
                )}
              </div>

              {/* Event list */}
              <div className="space-y-1.5">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Detection Log</p>
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {timelineSightings.map((s, i) => {
                    const label = s.identityType === 'KNOWN'
                      ? (typeof s.personId === 'object' && s.personId !== null ? s.personId.missingPersonName : 'Known') || 'Known'
                      : (typeof s.unknownPersonId === 'object' && s.unknownPersonId !== null ? s.unknownPersonId.unknownId : 'Unknown') || 'Unknown';
                    const isActive = timelineIndex === i;
                    return (
                      <button
                        key={s._id}
                        type="button"
                        onClick={() => { stopPlayback(); setTimelineIndex(i); }}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all cursor-pointer ${
                          isActive ? 'bg-slate-900 text-white' : 'bg-white border border-slate-100 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                          s.identityType === 'KNOWN' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                        }`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold truncate">{label}</p>
                          <p className={`text-[9px] font-mono truncate ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                            {new Date(s.detectedAt).toLocaleTimeString()} · {s.location?.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MAP AREA ── */}
      <div className="flex-grow h-full relative">
        <SightingMap
          sightings={visibleSightings}
          onSelectSighting={(s) => setSelectedSighting(s)}
          height="100%"
          showSequenceLine={true}
          showPredictivePath={showPredictivePath}
          selectedPersonKey={activePathPersonKey === 'ALL' ? undefined : activePathPersonKey}
          mapTileUrl={mapTileUrl}
          showHeatmap={showHeatmap}
          showClusters={showClusters}
        />

        {/* Map Overlay: Active Subject Count Badge */}
        <div className="absolute bottom-4 left-4 z-[1000] flex flex-col gap-2">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-md p-2.5 text-[10px] space-y-1.5">
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
              <Activity className="h-3.5 w-3.5 text-slate-700" />
              <span className="font-bold text-slate-900 text-[11px]">Live Intel</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-slate-400 uppercase font-bold text-[8px]">Visible</p>
                <p className="font-black text-slate-900">{visibleSightings.length}</p>
              </div>
              <div>
                <p className="text-slate-400 uppercase font-bold text-[8px]">Known</p>
                <p className="font-black text-emerald-700">{visibleSightings.filter((s) => s.identityType === 'KNOWN').length}</p>
              </div>
              <div>
                <p className="text-slate-400 uppercase font-bold text-[8px]">Unknown</p>
                <p className="font-black text-amber-700">{visibleSightings.filter((s) => s.identityType !== 'KNOWN').length}</p>
              </div>
              <div>
                <p className="text-slate-400 uppercase font-bold text-[8px]">Trajectories</p>
                <p className="font-black text-indigo-700">{multiLocationPredictions.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline playback indicator */}
        {isPlaying && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-red-600 text-white px-4 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            PLAYBACK — Frame {(timelineIndex ?? 0) + 1} / {timelineSightings.length}
          </div>
        )}
      </div>

      {/* ── Evidence Popup Modal ── */}
      <Modal isOpen={!!selectedSighting} onClose={() => setSelectedSighting(null)} title="Detection Evidence Record">
        {selectedSighting && (
          <div className="space-y-4 text-xs select-none">
            <div className="flex gap-4 items-start bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800">
              {selectedSighting.snapshotObjectKey ? (
                <img
                  src={getSnapshotUrl(selectedSighting.snapshotObjectKey)}
                  alt="Detection Snapshot"
                  className="w-24 h-24 rounded-lg border border-slate-700 object-cover shrink-0"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-24 h-24 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 border border-slate-700">
                  <UserSearch className="h-8 w-8" />
                </div>
              )}

              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm font-bold truncate">
                    {selectedSighting.identityType === 'KNOWN'
                      ? (typeof selectedSighting.personId === 'object' && selectedSighting.personId !== null ? selectedSighting.personId.missingPersonName : undefined) || 'Registered Subject'
                      : (typeof selectedSighting.unknownPersonId === 'object' && selectedSighting.unknownPersonId !== null ? selectedSighting.unknownPersonId.unknownId : undefined) || 'Unknown Subject'}
                  </p>
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded text-white ${
                    selectedSighting.identityType === 'KNOWN' ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}>
                    {selectedSighting.identityType}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-semibold">{selectedSighting.location?.name || 'Unknown Location'}</p>
                <p className="text-[11px] text-slate-400 font-mono">{new Date(selectedSighting.detectedAt).toLocaleString()}</p>
                <p className="text-[11px] text-emerald-400 font-bold">
                  Match Confidence: {Math.round(selectedSighting.similarity * 100)}%
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-slate-700">
              <p>
                <strong>Source:</strong>{' '}
                {selectedSighting.sourceType === 'LIVE_CCTV'
                  ? `Live CCTV — ${typeof selectedSighting.cameraId === 'object' && selectedSighting.cameraId !== null ? selectedSighting.cameraId.name : 'CCTV Stream'}`
                  : `Uploaded Video — ${typeof selectedSighting.videoId === 'object' && selectedSighting.videoId !== null ? selectedSighting.videoId.originalName : 'Video File'}`}
              </p>
              {selectedSighting.videoTimestampSeconds !== undefined && (
                <p>
                  <strong>Video Frame Timestamp:</strong>{' '}
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                    {selectedSighting.videoTimestampSeconds.toFixed(1)}s
                  </span>
                </p>
              )}
              <p className="font-mono text-[10.5px] text-slate-500 border-t border-slate-200/60 pt-1">
                Coordinates: {selectedSighting.location.latitude.toFixed(6)}, {selectedSighting.location.longitude.toFixed(6)}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSelectedSighting(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
