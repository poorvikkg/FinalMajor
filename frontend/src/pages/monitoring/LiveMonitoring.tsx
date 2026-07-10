import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SendReportModal } from '../../components/modals/SendReportModal';
import api from '../../api';

/* ─── Types ─────────────────────────────────────────── */
interface CameraItem {
  _id: string;
  name: string;
  location: string;
  rtspUrl?: string;
  status: 'online' | 'offline' | 'maintenance';
  type?: string;
}

interface SearchResult {
  _id: string;
  personName?: string;
  isUnknown: boolean;
  confidence: number;
  timestamp: string;
  snapshot?: string;
  cameraId?: { _id: string; name: string; location: string };
}

type GridLayout = 1 | 2 | 4 | 6 | 9;

/* ─── Single camera tile ─────────────────────────────── */
const CameraTile: React.FC<{
  cam: CameraItem;
  isSelected: boolean;
  onSelect: () => void;
  timestamp: string;
}> = ({ cam, isSelected, onSelect, timestamp }) => (
  <div
    className={`border cursor-pointer transition-colors ${
      isSelected ? 'border-slate-900' : 'border-slate-200 hover:border-slate-400'
    } bg-white`}
    onClick={onSelect}
  >
    {/* Feed area */}
    <div className="aspect-video bg-black relative overflow-hidden">
      {cam.status === 'online' ? (
        cam.rtspUrl?.startsWith('http') ? (
          <video src={cam.rtspUrl} autoPlay muted className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-center px-4">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse mb-1" />
            <p className="text-[10px] font-black text-white uppercase tracking-wider">LIVE</p>
            {cam.rtspUrl && (
              <p className="text-[9px] font-mono text-slate-500 break-all leading-tight">{cam.rtspUrl}</p>
            )}
          </div>
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
            {cam.status === 'offline' ? 'OFFLINE' : 'MAINTENANCE'}
          </p>
        </div>
      )}

      {/* Overlay: cam name + time */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 flex justify-between items-center">
        <span className="text-[9px] font-bold text-white truncate">{cam.name}</span>
        {cam.status === 'online' && (
          <span className="text-[9px] font-mono text-slate-300 shrink-0 ml-2">{timestamp}</span>
        )}
      </div>
    </div>

    {/* Info row */}
    <div className="px-2 py-1.5 flex items-center justify-between">
      <p className="text-[10px] text-slate-500 truncate">{cam.location}</p>
      <span
        className={`text-[9px] font-black uppercase tracking-wider ${
          cam.status === 'online' ? 'text-emerald-600' : 'text-red-500'
        }`}
      >
        {cam.status}
      </span>
    </div>
  </div>
);

/* ─── Main page ──────────────────────────────────────── */
export const LiveMonitoring: React.FC = () => {
  const queryClient = useQueryClient();
  const [timestamp, setTimestamp] = useState(new Date().toLocaleTimeString());
  const [gridLayout, setGridLayout] = useState<GridLayout>(4);
  const [selectedCams, setSelectedCams] = useState<Set<string>>(new Set());
  
  // Report Modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportLogId, setReportLogId] = useState('');
  const [reportPersonName, setReportPersonName] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Add RTSP form
  const [rtspName, setRtspName] = useState('');
  const [rtspLocation, setRtspLocation] = useState('');
  const [rtspUrl, setRtspUrl] = useState('');
  const [rtspError, setRtspError] = useState<string | null>(null);

  // Person search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSubmitted, setSearchSubmitted] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTimestamp(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch cameras
  const { data: cameras = [], isLoading } = useQuery<CameraItem[]>({
    queryKey: ['monitoringCameras'],
    queryFn: async () => {
      try {
        const r = await api.get('/cameras?limit=50');
        return r.data.data;
      } catch {
        return [];
      }
    },
    refetchInterval: 15000,
  });

  // Auto-select all online cameras on first load
  useEffect(() => {
    if (cameras.length > 0 && selectedCams.size === 0) {
      const online = cameras.filter(c => c.status === 'online').map(c => c._id);
      setSelectedCams(new Set(online.slice(0, 9)));
    }
  }, [cameras]);

  // Toggle camera selection for grid
  const toggleCam = (id: string) => {
    setSelectedCams(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= gridLayout) {
          // Replace oldest selected (first in set)
          const [first] = next;
          next.delete(first);
        }
        next.add(id);
      }
      return next;
    });
  };

  // Add camera mutation
  const addCamMutation = useMutation({
    mutationFn: async () => {
      await api.post('/cameras', { name: rtspName, location: rtspLocation, rtspUrl, type: 'rtsp' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoringCameras'] });
      setIsAddOpen(false);
      setRtspName(''); setRtspLocation(''); setRtspUrl(''); setRtspError(null);
    },
    onError: (err: any) => setRtspError(err.response?.data?.message || 'Failed to register camera.'),
  });

  const handleAddCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rtspUrl.match(/^(rtsp|rtmp|http|https):\/\//)) {
      setRtspError('URL must begin with rtsp://, rtmp://, or http://');
      return;
    }
    setRtspError(null);
    addCamMutation.mutate();
  };

  // Person search across recognition logs
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    setSearchSubmitted(searchQuery.trim());
    try {
      const q = encodeURIComponent(searchQuery.trim());
      const res = await api.get(`/recognition/logs?limit=50&personName=${q}`);
      const matched: SearchResult[] = res.data.data || [];
      
      setSearchResults(matched);
      if (matched.length === 0) setSearchError('No detections found for this person in the database.');
    } catch {
      setSearchError('Search failed. Check server connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchSubmitted('');
    setSearchResults([]);
    setSearchError(null);
  };

  const activeCams = cameras.filter(c => selectedCams.has(c._id));

  const gridClass: Record<GridLayout, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    4: 'grid-cols-2 lg:grid-cols-2',
    6: 'grid-cols-2 lg:grid-cols-3',
    9: 'grid-cols-3',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Live Camera Monitoring</h1>
          <p className="text-sm text-slate-500 mt-1">
            {cameras.filter(c => c.status === 'online').length} online / {cameras.length} total cameras
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>Add RTSP Stream</Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

        {/* LEFT: Camera list sidebar */}
        <div className="xl:col-span-1 space-y-4">
          
          {/* Detection Mode */}
          <Card>
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <CardTitle className="text-sm">Detection Mode</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <select className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900">
                <option value="global">Compare with Entire Database</option>
                <option value="specific">Track Selected Person</option>
              </select>
              <p className="text-xs text-slate-500 mt-2">
                Choose whether the AI should flag anyone in the database, or only track a specific target.
              </p>
            </CardContent>
          </Card>

          {/* Grid layout selector */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-slate-700 mb-3">Grid Layout</p>
              <div className="grid grid-cols-5 gap-2">
                {([1, 2, 4, 6, 9] as GridLayout[]).map(n => (
                  <button
                    key={n}
                    onClick={() => setGridLayout(n)}
                    className={`py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      gridLayout === n
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {n === 1 ? '1×1' : n === 2 ? '1×2' : n === 4 ? '2×2' : n === 6 ? '2×3' : '3×3'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Select up to {gridLayout} camera{gridLayout > 1 ? 's' : ''} from the list below.
              </p>
            </CardContent>
          </Card>

          {/* Camera list */}
          <Card>
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <CardTitle className="text-sm">Camera Stations</CardTitle>
            </CardHeader>
            <CardContent className="p-2 max-h-80 overflow-y-auto">
              {isLoading ? (
                <p className="p-3 text-sm text-slate-500">Loading...</p>
              ) : cameras.length === 0 ? (
                <p className="p-3 text-sm text-slate-500">No cameras registered.</p>
              ) : (
                <div className="space-y-1">
                  {cameras.map(cam => {
                    const sel = selectedCams.has(cam._id);
                    return (
                      <button
                        key={cam._id}
                        onClick={() => toggleCam(cam._id)}
                        className={`w-full text-left px-3 py-2 rounded-md flex items-center justify-between text-sm transition-colors ${
                          sel
                            ? 'bg-slate-100 text-slate-900 font-medium'
                            : 'bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate">{cam.name}</p>
                          <p className="text-xs text-slate-400 truncate">
                            {cam.location}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold shrink-0 ml-2 ${
                          cam.status === 'online' ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {cam.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Person Search */}
          <Card>
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <CardTitle className="text-sm">Search Person</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <form onSubmit={handleSearch} className="space-y-3">
                <Input
                  label="Person Name"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="e.g. John Doe"
                />
                <div className="flex gap-2">
                  <Button type="submit" isLoading={isSearching} className="flex-1 text-sm py-1.5 h-auto">Search</Button>
                  {searchSubmitted && (
                    <Button type="button" variant="outline" onClick={clearSearch} className="text-sm py-1.5 h-auto">Clear</Button>
                  )}
                </div>
              </form>

              {searchError && (
                <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider border border-red-200 bg-red-50 px-3 py-2">
                  {searchError}
                </p>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    {searchResults.length} detection{searchResults.length !== 1 ? 's' : ''} for "{searchSubmitted}"
                  </p>
                  <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {searchResults.map(log => (
                      <div key={log._id} className="py-2">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-900 truncate">
                              {log.cameraId?.name || 'Unknown Camera'}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {log.cameraId?.location || '—'}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400">
                              {new Date(log.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                            {Math.round(log.confidence * 100)}%
                          </span>
                        </div>
                        <div className="flex gap-2 items-end mt-1">
                          {log.snapshot && (
                            <img
                              src={`/uploads/${log.snapshot}`}
                              alt="snapshot"
                              className="h-10 w-10 object-cover border border-slate-200"
                            />
                          )}
                          {!log.isUnknown && (
                            <Button 
                              variant="outline" 
                              className="text-[10px] py-1 h-auto px-2 border-slate-300"
                              onClick={() => {
                                setReportLogId(log._id);
                                setReportPersonName(log.personName || 'Unknown');
                                setIsReportModalOpen(true);
                              }}
                            >
                              Send Report
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Multi-camera grid */}
        <div className="xl:col-span-3">
          {/* Status bar */}
          <div className="flex justify-between items-center px-3 py-2 bg-slate-900 text-white mb-2">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-wider">LIVE FEED</span>
            </div>
            <span className="font-mono text-[11px] text-slate-300">{timestamp}</span>
          </div>

          {activeCams.length === 0 ? (
            <div className="aspect-video bg-slate-100 border border-slate-200 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">No Camera Selected</p>
                <p className="text-[11px] text-slate-400 mt-1">Select cameras from the list on the left.</p>
              </div>
            </div>
          ) : (
            <div className={`grid gap-1 ${gridClass[gridLayout]}`}>
              {activeCams.map(cam => (
                <CameraTile
                  key={cam._id}
                  cam={cam}
                  isSelected={selectedCams.has(cam._id)}
                  onSelect={() => toggleCam(cam._id)}
                  timestamp={timestamp}
                />
              ))}
              {/* Empty filler tiles if fewer cams selected than grid size */}
              {Array.from({ length: Math.max(0, gridLayout - activeCams.length) }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="aspect-video bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center"
                >
                  <p className="text-[10px] text-slate-300 font-black uppercase tracking-wider">Empty Slot</p>
                </div>
              ))}
            </div>
          )}

          {/* Search results highlight — cameras with detections */}
          {searchResults.length > 0 && (
            <div className="mt-3 border border-slate-300 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2">
                Cameras where "{searchSubmitted}" was detected:
              </p>
              <div className="flex flex-wrap gap-2">
                {[...new Map(
                  searchResults
                    .filter(r => r.cameraId)
                    .map(r => [r.cameraId!._id, r.cameraId!])
                ).values()].map(cam => (
                  <button
                    key={cam._id}
                    onClick={() => {
                      const found = cameras.find(c => c._id === cam._id);
                      if (found) {
                        setSelectedCams(new Set([found._id]));
                        setGridLayout(1);
                      }
                    }}
                    className="text-[11px] font-bold uppercase tracking-wider border border-slate-900 px-3 py-1.5 bg-white hover:bg-slate-900 hover:text-white transition-colors"
                  >
                    {cam.name} — {cam.location}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add RTSP Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Register RTSP Camera">
        <form onSubmit={handleAddCamera} className="space-y-4">
          <p className="text-[11px] text-slate-500 border border-slate-200 bg-slate-50 px-3 py-2">
            Register an RTSP or HTTP camera stream. HTTP/HLS URLs play directly in the browser.
            RTSP URLs are stored as metadata and require a server-side HLS transcoder for live playback.
          </p>
          <Input label="Camera Name *" value={rtspName} onChange={e => setRtspName(e.target.value)} required />
          <Input label="Location / Station *" value={rtspLocation} onChange={e => setRtspLocation(e.target.value)} required />
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-800">Stream URL *</label>
            <input
              type="text"
              value={rtspUrl}
              onChange={e => setRtspUrl(e.target.value)}
              placeholder="rtsp://192.168.1.100:554/stream  or  http://server/stream.m3u8"
              required
              className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">Supported: rtsp:// · rtmp:// · http:// · https://</p>
          </div>
          {rtspError && (
            <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider border border-red-200 bg-red-50 px-3 py-2">
              {rtspError}
            </p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={addCamMutation.isPending}>Register</Button>
          </div>
        </form>
      </Modal>

      {/* Send Report Modal */}
      {isReportModalOpen && (
        <SendReportModal 
          isOpen={isReportModalOpen} 
          onClose={() => setIsReportModalOpen(false)} 
          logId={reportLogId}
          personName={reportPersonName}
        />
      )}
    </div>
  );
};
export default LiveMonitoring;
