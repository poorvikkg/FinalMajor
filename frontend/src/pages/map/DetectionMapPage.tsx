import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
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
  Zap,
  Navigation,
  Compass,
  Target,
  Clock,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export function DetectionMapPage() {
  const [page] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [identityFilter, setIdentityFilter] = useState<'ALL' | SightingIdentityType>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | SightingSourceType>('ALL');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSighting, setSelectedSighting] = useState<Sighting | null>(null);

  // Path Trajectory State
  const [showPredictivePath, setShowPredictivePath] = useState(true);
  const [activePathPersonKey, setActivePathPersonKey] = useState<string>('ALL');
  const [isTriggeringCorridor, setIsTriggeringCorridor] = useState(false);
  const [triggerStatusMessage, setTriggerStatusMessage] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Fetch complaints list for person selector dropdown
  const { data: complaints = [] } = useQuery({
    queryKey: ['complaintsDropdownList'],
    queryFn: async () => {
      try {
        const res = await api.get('/complaints?limit=200');
        return res.data.data || [];
      } catch {
        return [];
      }
    },
  });

  // Fetch sightings
  const { data } = useQuery({
    queryKey: [
      'sightings',
      page,
      identityFilter,
      sourceFilter,
      selectedPersonId,
      startDate,
      endDate,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '100',
      });
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

  // Socket.IO real-time listener for sighting:new
  useEffect(() => {
    const handleNewSighting = (newSighting: Sighting) => {
      queryClient.setQueryData(
        [
          'sightings',
          page,
          identityFilter,
          sourceFilter,
          startDate,
          endDate,
        ],
        (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: [newSighting, ...(oldData.data || [])],
          };
        }
      );
    };

    socket.on('sighting:new', handleNewSighting);
    return () => {
      socket.off('sighting:new', handleNewSighting);
    };
  }, [queryClient, page, identityFilter, sourceFilter, startDate, endDate]);

  const rawSightings: Sighting[] = data?.data || [];

  // Local search filter by person name or unknown ID
  const filteredSightings = rawSightings.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const personName = (typeof s.personId === 'object' && s.personId !== null ? s.personId.missingPersonName : '')?.toLowerCase() || '';
    const complaintId = (typeof s.personId === 'object' && s.personId !== null ? s.personId.complaintId : '')?.toLowerCase() || '';
    const unknownId = (typeof s.unknownPersonId === 'object' && s.unknownPersonId !== null ? s.unknownPersonId.unknownId : '')?.toLowerCase() || '';
    const locName = s.location?.name?.toLowerCase() || '';
    return (
      personName.includes(q) ||
      complaintId.includes(q) ||
      unknownId.includes(q) ||
      locName.includes(q)
    );
  });

  // Calculate multi-location path predictions across filtered sightings
  const multiLocationPredictions = useMemo(() => {
    return getMultiLocationPathPredictions(filteredSightings);
  }, [filteredSightings]);

  // Currently focused prediction object for prediction card display
  const activePrediction: PersonPathPrediction | null = useMemo(() => {
    if (multiLocationPredictions.length === 0) return null;
    if (activePathPersonKey === 'ALL' || !activePathPersonKey) {
      return multiLocationPredictions[0];
    }
    return (
      multiLocationPredictions.find((p) => p.personKey === activePathPersonKey) ||
      multiLocationPredictions[0]
    );
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

      const targetUserId =
        activePrediction.identityType === 'KNOWN'
          ? activePrediction.personKey.replace('known_', '')
          : undefined;

      const res = await api.post('/cameras/auto-trigger-corridor', {
        points,
        radiusMeters: 2000,
        target_user_id: targetUserId,
      });

      const count = res.data?.data?.triggeredCount || 0;
      setTriggerStatusMessage(`⚡ Auto-triggered ${count} CCTV stream(s) along suspect's movement corridor!`);
    } catch (err: any) {
      setTriggerStatusMessage(`Auto-trigger failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsTriggeringCorridor(false);
    }
  };

  return (
    <div className="space-y-5 pb-12 select-none">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <MapPin className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Detection Location Map
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-normal">
            Real-time geospatial observation map with automated movement trajectory analysis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
            <Zap className="h-3.5 w-3.5 text-slate-900" />
            Live Broadcast Active
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Identity Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Identity Type
            </label>
            <select
              value={identityFilter}
              onChange={(e) => setIdentityFilter(e.target.value as any)}
              className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium text-slate-800"
            >
              <option value="ALL">All Identities</option>
              <option value="KNOWN">Registered Persons</option>
              <option value="UNKNOWN">Recurring Unknowns</option>
            </select>
          </div>

          {/* Specific Person Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Registered Person
            </label>
            <select
              value={selectedPersonId}
              onChange={(e) => {
                setSelectedPersonId(e.target.value);
                if (e.target.value) setIdentityFilter('KNOWN');
              }}
              className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium text-slate-800 truncate"
            >
              <option value="">-- All Persons --</option>
              {complaints
                .filter((c: any) => c._id && c.missingPersonName)
                .map((c: any) => (
                  <option key={c._id} value={c._id}>
                    {c.missingPersonName} ({c.complaintId || 'Case'})
                  </option>
                ))}
            </select>
          </div>

          {/* Source Type Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Detection Source
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium text-slate-800"
            >
              <option value="ALL">All Sources</option>
              <option value="LIVE_CCTV">Live CCTV Streams</option>
              <option value="UPLOADED_VIDEO">Uploaded Videos</option>
            </select>
          </div>

          {/* Date Range Start */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium text-slate-800"
            />
          </div>

          {/* Date Range End */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium text-slate-800"
            />
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by missing person name, complaint ID, unknown subject ID, or location..."
            className="w-full pl-9 pr-4 py-2 rounded-lg text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium text-slate-900"
          />
        </div>
      </div>

      {/* Path Trajectory Analysis Panel */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-slate-900" />
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Movement Path Trajectory & Prediction
              {multiLocationPredictions.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200 font-mono">
                  {multiLocationPredictions.length} Subject{multiLocationPredictions.length > 1 ? 's' : ''} in Multiple Spots
                </span>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {activePrediction && (
              <button
                type="button"
                onClick={handleAutoTriggerCorridor}
                disabled={isTriggeringCorridor}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-all disabled:opacity-50"
              >
                <Zap className="h-3.5 w-3.5 fill-slate-950" />
                <span>{isTriggeringCorridor ? 'Scanning Path...' : 'Auto-Trigger Path Cameras'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowPredictivePath(!showPredictivePath)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                showPredictivePath
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Show Probable Trajectory</span>
            </button>
          </div>
        </div>

        {triggerStatusMessage && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-between">
            <span>{triggerStatusMessage}</span>
            <button
              type="button"
              onClick={() => setTriggerStatusMessage(null)}
              className="text-amber-700 hover:text-amber-950 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Subject Selector & Metrics */}
        {multiLocationPredictions.length > 0 ? (
          <div className="space-y-3">
            {/* Subject Selector Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                <Activity className="h-3.5 w-3.5 text-slate-500" />
                Select Subject:
              </span>
              <button
                type="button"
                onClick={() => setActivePathPersonKey('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                  activePathPersonKey === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                All Subjects ({multiLocationPredictions.length})
              </button>
              {multiLocationPredictions.map((pred) => (
                <button
                  key={pred.personKey}
                  type="button"
                  onClick={() => setActivePathPersonKey(pred.personKey)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 ${
                    activePathPersonKey === pred.personKey
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <span>{pred.personName}</span>
                  <span className="text-[10px] font-mono opacity-80">({pred.observedPoints.length} spots)</span>
                </button>
              ))}
            </div>

            {/* Metrics Dashboard Grid */}
            {activePrediction && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 text-xs">
                {/* 1. Tracked Subject */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tracked Subject</p>
                  <p className="font-bold text-slate-900 truncate">{activePrediction.personName}</p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    📍 {activePrediction.observedPoints.length} Spots • {(activePrediction.totalDistanceMeters / 1000).toFixed(1)} km
                  </p>
                </div>

                {/* 2. Movement Heading */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Compass className="h-3 w-3 text-slate-500" /> Movement Heading
                  </p>
                  <p className="font-bold text-slate-900">{activePrediction.bearingLabel}</p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Speed: {activePrediction.recentSpeedKmH || 4.5} km/h
                  </p>
                </div>

                {/* 3. Last Spotted */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-500" /> Last Spotted
                  </p>
                  <p className="font-semibold text-slate-800 truncate">📍 {activePrediction.lastSeenLocationName}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{activePrediction.lastSeenTime}</p>
                </div>

                {/* 4. Probable Destination (+15m) */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Target className="h-3 w-3 text-slate-500" /> Next Destination (+15m)
                  </p>
                  <p className="font-bold font-mono text-slate-900">
                    ETA: {activePrediction.predictedWaypoints[0]?.estimatedTime || 'N/A'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {activePrediction.predictedWaypoints[0]?.latitude.toFixed(4)}, {activePrediction.predictedWaypoints[0]?.longitude.toFixed(4)}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
            No subjects currently detected in multiple camera locations in current filter selection.
          </div>
        )}
      </div>

      {/* Main Map Container */}
      <Card className="border-slate-200 shadow-xs bg-white rounded-xl overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between bg-white">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Detection Map ({filteredSightings.length} Markers)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <SightingMap
            sightings={filteredSightings}
            onSelectSighting={(s) => setSelectedSighting(s)}
            height="600px"
            showSequenceLine={true}
            showPredictivePath={showPredictivePath}
            selectedPersonKey={activePathPersonKey === 'ALL' ? undefined : activePathPersonKey}
          />
        </CardContent>
      </Card>

      {/* Evidence Popup Modal */}
      <Modal
        isOpen={!!selectedSighting}
        onClose={() => setSelectedSighting(null)}
        title="Detection Evidence Record"
      >
        {selectedSighting && (
          <div className="space-y-4 text-xs select-none">
            <div className="flex gap-4 items-start bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800">
              {selectedSighting.snapshotObjectKey ? (
                <img
                  src={getSnapshotUrl(selectedSighting.snapshotObjectKey)}
                  alt="Detection Snapshot"
                  className="w-24 h-24 rounded-lg border border-slate-700 object-cover shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
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
                  <span
                    className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded text-white ${
                      selectedSighting.identityType === 'KNOWN' ? 'bg-emerald-600' : 'bg-slate-700'
                    }`}
                  >
                    {selectedSighting.identityType}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 font-semibold">
                  📍 {selectedSighting.location?.name || 'Unknown Location'}
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                  {new Date(selectedSighting.detectedAt).toLocaleString()}
                </p>
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
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">{selectedSighting.videoTimestampSeconds.toFixed(1)}s</span>
                </p>
              )}
              <p className="font-mono text-[10.5px] text-slate-500 border-t border-slate-200/60 pt-1">
                Coordinates: {selectedSighting.location.latitude.toFixed(6)}, {selectedSighting.location.longitude.toFixed(6)}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSelectedSighting(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
