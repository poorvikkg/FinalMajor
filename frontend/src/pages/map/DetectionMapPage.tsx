import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { SightingMap } from '../../components/map/SightingMap';
import api from '../../api';
import { socket } from '../../socket';
import type { Sighting, SightingIdentityType, SightingSourceType } from '../../types';
import {
  MapPin,
  Search,
  UserSearch,
  Zap,
} from 'lucide-react';

const getSnapshotUrl = (pathStr?: string) => {
  if (!pathStr) return '';
  const normalized = pathStr.replace(/\\/g, '/');
  if (normalized.startsWith('http')) return normalized;
  return `/${normalized}`;
};

export function DetectionMapPage() {
  const [page] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [identityFilter, setIdentityFilter] = useState<'ALL' | SightingIdentityType>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | SightingSourceType>('ALL');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSighting, setSelectedSighting] = useState<Sighting | null>(null);

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
    const personName = s.personId?.missingPersonName?.toLowerCase() || '';
    const complaintId = s.personId?.complaintId?.toLowerCase() || '';
    const unknownId = s.unknownPersonId?.unknownId?.toLowerCase() || '';
    const locName = s.location?.name?.toLowerCase() || '';
    return (
      personName.includes(q) ||
      complaintId.includes(q) ||
      unknownId.includes(q) ||
      locName.includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <MapPin className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Detection Location Map
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time geospatial observations of registered missing persons and recurring unknown identity detections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
            <Zap className="h-3.5 w-3.5 text-slate-900" />
            Socket.IO Live Marker Broadcast Active
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Identity Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Identity Type
            </label>
            <select
              value={identityFilter}
              onChange={(e) => setIdentityFilter(e.target.value as any)}
              className="w-full text-xs p-2 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-semibold"
            >
              <option value="ALL">All Identities</option>
              <option value="KNOWN">Registered Persons</option>
              <option value="UNKNOWN">Recurring Unknowns</option>
            </select>
          </div>

          {/* Specific Person Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Registered Person
            </label>
            <select
              value={selectedPersonId}
              onChange={(e) => {
                setSelectedPersonId(e.target.value);
                if (e.target.value) setIdentityFilter('KNOWN');
              }}
              className="w-full text-xs p-2 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-semibold truncate"
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
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Detection Source
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="w-full text-xs p-2 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-semibold"
            >
              <option value="ALL">All Sources</option>
              <option value="LIVE_CCTV">Live CCTV Streams</option>
              <option value="UPLOADED_VIDEO">Uploaded Videos</option>
            </select>
          </div>

          {/* Date Range Start */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs p-2 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-semibold"
            />
          </div>

          {/* Date Range End */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs p-2 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-semibold"
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
            placeholder="Search by person name, complaint ID, unknown ID, or location..."
            className="w-full pl-9 pr-4 py-2 rounded text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* Main Map Container */}
      <Card className="border-slate-200">
        <CardHeader className="py-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Interactive Detection Location Map ({filteredSightings.length} Markers)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <SightingMap
            sightings={filteredSightings}
            onSelectSighting={(s) => setSelectedSighting(s)}
            height="580px"
            showSequenceLine={true}
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
            <div className="flex gap-4 items-start bg-slate-900 text-white p-3.5 rounded-lg">
              {selectedSighting.snapshotObjectKey ? (
                <img
                  src={getSnapshotUrl(selectedSighting.snapshotObjectKey)}
                  alt="Detection Snapshot"
                  className="w-24 h-24 rounded border border-slate-700 object-cover shrink-0"
                />
              ) : (
                <div className="w-24 h-24 rounded bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  <UserSearch className="h-8 w-8" />
                </div>
              )}

              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm font-bold truncate">
                    {selectedSighting.identityType === 'KNOWN'
                      ? selectedSighting.personId?.missingPersonName || 'Registered Subject'
                      : selectedSighting.unknownPersonId?.unknownId || 'Unknown Subject'}
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
                  📍 {selectedSighting.location.name}
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                  {new Date(selectedSighting.detectedAt).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-300 font-bold">
                  Match Confidence: {Math.round(selectedSighting.similarity * 100)}%
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-1.5 text-slate-700">
              <p>
                <strong>Source:</strong>{' '}
                {selectedSighting.sourceType === 'LIVE_CCTV'
                  ? `Live CCTV — ${selectedSighting.cameraId?.name || 'CCTV Stream'}`
                  : `Uploaded Video — ${selectedSighting.videoId?.originalName || 'Video File'}`}
              </p>
              {selectedSighting.videoTimestampSeconds !== undefined && (
                <p>
                  <strong>Video Frame Timestamp:</strong>{' '}
                  <span className="font-mono">{selectedSighting.videoTimestampSeconds.toFixed(1)}s</span>
                </p>
              )}
              <p className="font-mono text-[10px] text-slate-500">
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
