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
        const res = await api.get('/complaints?limit=200&allStations=true');
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
      setTriggerStatusMessage(`Auto-triggered ${count} CCTV stream(s) along suspect's movement corridor!`);
    } catch (err: any) {
      setTriggerStatusMessage(`Auto-trigger failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsTriggeringCorridor(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-72px)] overflow-hidden bg-slate-50">
      
      {/* LEFT SIDEBAR PANEL */}
      <div className="w-[380px] border-r border-slate-200 bg-white flex flex-col h-full overflow-hidden flex-shrink-0">
        
        {/* Title & Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-900 text-white rounded-lg">
              <MapPin className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">Detection Location Map</h2>
          </div>
        </div>

        {/* Scrollable Sidebar Content */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          
          {/* Section: Filters */}
          <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Map Filters</p>
            
            {/* Identity Type */}
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                Identity Type
              </label>
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

            {/* Registered Person */}
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                Registered Person
              </label>
              <select
                value={selectedPersonId}
                onChange={(e) => {
                  setSelectedPersonId(e.target.value);
                  if (e.target.value) setIdentityFilter('KNOWN');
                }}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white text-slate-800"
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

            {/* Source */}
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">
                Detection Source
              </label>
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

            {/* Date range inputs */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-[11px] p-2 rounded-lg border border-slate-200 bg-white"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-[11px] p-2 rounded-lg border border-slate-200 bg-white"
                />
              </div>
            </div>

            {/* Search Input */}
            <div className="relative pt-1">
              <Search className="absolute left-2.5 top-[55%] -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, complaint ID, location..."
                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs border border-slate-200 bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Section: Trajectory Analysis */}
          <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <p className="text-[10px] font-bold text-slate-900 flex items-center gap-1.5">
                <Navigation className="h-3.5 w-3.5 text-slate-700 font-bold" />
                Trajectory Analysis
              </p>
              {multiLocationPredictions.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[8px] font-bold border">
                  {multiLocationPredictions.length} Active
                </span>
              )}
            </div>

            {/* Auto Trigger status messages */}
            {triggerStatusMessage && (
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-semibold flex items-center justify-between">
                <span>{triggerStatusMessage}</span>
                <button type="button" onClick={() => setTriggerStatusMessage(null)} className="text-amber-700">✕</button>
              </div>
            )}

            {/* Subject filter selectors */}
            {multiLocationPredictions.length > 0 ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Subject Filter</label>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setActivePathPersonKey('ALL')}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                        activePathPersonKey === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      All ({multiLocationPredictions.length})
                    </button>
                    {multiLocationPredictions.map((pred) => (
                      <button
                        key={pred.personKey}
                        type="button"
                        onClick={() => setActivePathPersonKey(pred.personKey)}
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                          activePathPersonKey === pred.personKey ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block animate-ping" />
                        <span>{pred.personName}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trajectory action buttons */}
                <div className="flex gap-2 pt-1">
                  {activePrediction && (
                    <button
                      type="button"
                      onClick={handleAutoTriggerCorridor}
                      disabled={isTriggeringCorridor}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-[10px] shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {isTriggeringCorridor ? 'Scanning...' : 'Trigger Cameras'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPredictivePath(!showPredictivePath)}
                    className={`flex-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                      showPredictivePath ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {showPredictivePath ? 'Hide Path' : 'Show Predictive Path'}
                  </button>
                </div>

                {/* Stacked Trajectory Metrics */}
                {activePrediction && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    
                    {/* Metric 1 */}
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tracked Subject</p>
                        <p className="font-extrabold text-slate-900 text-xs truncate max-w-[160px]">{activePrediction.personName}</p>
                      </div>
                      <div className="text-right text-[10px] font-semibold text-slate-600 font-mono">
                        <p>{activePrediction.observedPoints.length} Sightings</p>
                        <p>{(activePrediction.totalDistanceMeters / 1000).toFixed(1)} km</p>
                      </div>
                    </div>

                    {/* Metric 2 */}
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Heading Vector</p>
                        <p className="font-extrabold text-slate-900 text-xs">
                          {activePrediction.bearingLabel} ({activePrediction.bearingDegrees.toFixed(0)}°)
                        </p>
                      </div>
                      <div className="text-right text-[10px] font-semibold text-slate-600 font-mono">
                        <p>Speed</p>
                        <p>{activePrediction.recentSpeedKmH.toFixed(1)} km/h</p>
                      </div>
                    </div>

                    {/* Metric 3 */}
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-150">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Last Spotted</p>
                      <p className="font-extrabold text-slate-900 text-xs truncate">{activePrediction.lastSeenLocationName}</p>
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5">Time: {activePrediction.lastSeenTime}</p>
                    </div>

                    {/* Metric 4 */}
                    <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/80">
                      <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1">
                        <Target className="h-3 w-3" /> Projected Destination (+15m)
                      </p>
                      <p className="font-black text-indigo-950 text-xs mt-0.5">ETA: {activePrediction.predictedWaypoints[0]?.estimatedTime || 'N/A'}</p>
                      <p className="text-[9px] text-indigo-700 font-bold font-mono mt-1">
                        Coord: {activePrediction.predictedWaypoints[0]?.latitude.toFixed(4)}, {activePrediction.predictedWaypoints[0]?.longitude.toFixed(4)}
                      </p>
                    </div>

                  </div>
                )}

              </div>
            ) : (
              <div className="p-3 bg-slate-50 text-[10px] text-slate-500 rounded-lg text-center font-medium">
                No subjects detected in multiple cameras.
              </div>
            )}
          </div>

        </div>

      </div>

      {/* RIGHT MAP CONTAINER */}
      <div className="flex-grow h-full relative">
        <SightingMap
          sightings={filteredSightings}
          onSelectSighting={(s) => setSelectedSighting(s)}
          height="100%"
          showSequenceLine={true}
          showPredictivePath={showPredictivePath}
          selectedPersonKey={activePathPersonKey === 'ALL' ? undefined : activePathPersonKey}
        />
      </div>

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
                  {selectedSighting.location?.name || 'Unknown Location'}
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
