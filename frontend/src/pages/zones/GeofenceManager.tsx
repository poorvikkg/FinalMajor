/**
 * GeofenceManager.tsx
 * Draw, manage, and monitor city geofence zones.
 *
 * Features:
 *  - Leaflet map with Leaflet.Draw support for polygon drawing
 *  - Colored zone overlays on the map
 *  - Zone management sidebar (create, delete, toggle)
 *  - Real-time breach counter updates via Socket.IO
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Shield, Trash2, ToggleLeft, ToggleRight, Plus, AlertTriangle, Radar, Square, Hexagon } from 'lucide-react';
import api from '../../api';
import socket from '../../socket';
import { useAuthStore } from '../../store/auth';
import { Modal } from '../../components/ui/Modal';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

const ZONE_COLORS: Record<string, string> = {
  HIGH_SECURITY: '#ef4444',
  RESTRICTED: '#f59e0b',
  WATCH: '#3b82f6',
};

const ZONE_DESCRIPTIONS: Record<string, string> = {
  HIGH_SECURITY: 'Military/Govt — auto-escalates to CRITICAL',
  RESTRICTED: 'Schools/Hospitals — elevated priority',
  WATCH: 'Commercial/Public — standard monitoring',
};

export const GeofenceManager: React.FC = () => {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const zoneLayersRef = useRef<Map<string, any>>(new Map());
  const labelsRef = useRef<any[]>([]);
  const drawControlRef = useRef<any>(null);
  const currentDrawRef = useRef<any>(null);

  const [mapInstance, setMapInstance] = useState<any>(null);
  const [LInstance, setLInstance] = useState<any>(null);

  const [drawingMode, setDrawingMode] = useState(false);
  const [activeDrawShape, setActiveDrawShape] = useState<'polygon' | 'rectangle' | null>(null);
  const activeDrawHandlerRef = useRef<any>(null);
  const [pendingZone, setPendingZone] = useState<{ coords: number[][][]; center: { lat: number; lng: number } } | null>(null);
  const [formData, setFormData] = useState({ name: '', type: 'WATCH', description: '' });
  const [recentBreach, setRecentBreach] = useState<any>(null);

  // Scan Zone states
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanningZone, setScanningZone] = useState<any>(null);
  const [selectedSuspectId, setSelectedSuspectId] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Fetch complaints list for suspect list dropdown
  const { data: complaints = [] } = useQuery({
    queryKey: ['complaints-list-scan'],
    queryFn: async () => {
      try {
        const res = await api.get('/complaints?limit=300');
        return res.data.data || [];
      } catch {
        return [];
      }
    },
  });

  // Fetch unknown list for suspect list dropdown
  const { data: unknowns = [] } = useQuery({
    queryKey: ['unknowns-list-scan'],
    queryFn: async () => {
      try {
        const res = await api.get('/unknown-persons?limit=300');
        return res.data.data || [];
      } catch {
        return [];
      }
    },
  });

  const suspectList = useMemo(() => {
    const list: any[] = [];
    complaints.forEach((c: any) => {
      list.push({
        id: c._id,
        label: c.missingPersonName || c.complaintId || 'Known Missing Person',
        type: 'KNOWN',
      });
    });
    unknowns.forEach((u: any) => {
      list.push({
        id: u._id,
        label: u.unknownId || 'Unknown Recurring Person',
        type: 'UNKNOWN',
      });
    });
    return list;
  }, [complaints, unknowns]);

  const handleStartScan = async () => {
    if (!scanningZone || !selectedSuspectId) return;
    setIsScanning(true);
    setScanResult(null);
    try {
      const res = await api.post(`/zones/${scanningZone.zoneId}/trigger-scan`, {
        targetUserId: selectedSuspectId,
      });
      setScanResult(res.data.data);
    } catch (err: any) {
      setScanResult({ error: err.response?.data?.message || err.message });
    } finally {
      setIsScanning(false);
    }
  };

  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Fetch zones
  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => (await api.get('/zones')).data.data as any[],
    refetchInterval: 30000,
  });

  // Create zone mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => (await api.post('/zones', data)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      setPendingZone(null);
      setFormData({ name: '', type: 'WATCH', description: '' });
      setDrawingMode(false);
      setActiveDrawShape(null);
      activeDrawHandlerRef.current = null;
    },
  });

  // Delete zone mutation
  const deleteMutation = useMutation({
    mutationFn: async (zoneId: string) => api.delete(`/zones/${zoneId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });

  // Toggle zone mutation
  const toggleMutation = useMutation({
    mutationFn: async (zoneId: string) => (await api.patch(`/zones/${zoneId}/toggle`)).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });

  // Zone breach socket listener
  useEffect(() => {
    const handler = (data: any) => {
      setRecentBreach(data);
      setTimeout(() => setRecentBreach(null), 6000);
    };
    socket.on('zone:breach', handler);
    return () => { socket.off('zone:breach', handler); };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    import('leaflet').then((mod) => {
      const LMod = mod.default || mod;
      (window as any).L = LMod;
      leafletRef.current = LMod;
      setLInstance(LMod);

      import('leaflet-draw' as any).catch(() => null).then(() => {
        if (mapRef.current) return;

        const map = LMod.map(mapContainerRef.current!, { center: [12.9141, 74.856], zoom: 13 });
        LMod.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap © CartoDB', maxZoom: 19,
        }).addTo(map);

        mapRef.current = map;
        setMapInstance(map);

        // Polygon draw handler
        map.on('draw:created', (e: any) => {
          const layer = e.layer;
          const latlngs = layer.getLatLngs()[0] as any[];
          const coords = [...latlngs.map((ll: any) => [ll.lng, ll.lat])];
          coords.push(coords[0]); // close polygon

          const bounds = layer.getBounds();
          const center = bounds.getCenter();

          // Draw as GeoJSON polygon: [[[lng,lat],...]]
          setPendingZone({
            coords: [coords],
            center: { lat: center.lat, lng: center.lng },
          });

          layer.addTo(map);
          currentDrawRef.current = layer;
        });
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapInstance(null);
        setLInstance(null);
      }
    };
  }, []);

  // Render zones on map
  useEffect(() => {
    if (!mapInstance || !LInstance || !zones) return;
    const L = LInstance;

    // Remove old zone layers
    zoneLayersRef.current.forEach((layer) => { try { layer.remove(); } catch {} });
    zoneLayersRef.current.clear();

    // Remove old labels
    labelsRef.current.forEach((marker) => { try { marker.remove(); } catch {} });
    labelsRef.current = [];

    zones.forEach((zone) => {
      if (!zone.boundary?.coordinates) return;
      const color = ZONE_COLORS[zone.type] || '#3b82f6';
      const opacity = zone.isActive ? 0.25 : 0.08;

      const polygon = L.geoJSON(zone.boundary, {
        style: {
          color,
          fillColor: color,
          fillOpacity: opacity,
          weight: 2,
          dashArray: zone.isActive ? '' : '6 4',
        },
      })
        .addTo(mapInstance)
        .bindPopup(`
          <div style="min-width:160px;padding:4px">
            <b style="color:${color}">${zone.name}</b><br/>
            <span style="font-size:11px">${zone.type.replace('_', ' ')}</span><br/>
            <span style="font-size:10px;color:#94a3b8">Breaches: ${zone.totalBreaches || 0}</span><br/>
            <span style="font-size:10px;color:${zone.isActive ? '#10b981' : '#64748b'}">${zone.isActive ? 'Active' : 'Inactive'}</span>
          </div>
        `);

      // Label
      if (zone.centerLat && zone.centerLng) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${color}22;border:1px solid ${color}55;border-radius:6px;padding:2px 6px;font-size:10px;font-weight:700;color:${color};white-space:nowrap">${zone.name}</div>`,
          iconAnchor: [50, 10],
        });
        const labelMarker = L.marker([zone.centerLat, zone.centerLng], { icon }).addTo(mapInstance);
        labelsRef.current.push(labelMarker);
      }

      zoneLayersRef.current.set(zone.zoneId, polygon);
    });
  }, [zones, mapInstance, LInstance]);

  // Click-to-draw interactive fallback
  const setupClickToDrawFallback = (shapeType: 'polygon' | 'rectangle') => {
    if (!mapInstance || !LInstance) return;
    const L = LInstance;
    let points: [number, number][] = [];

    const onMapClick = (e: any) => {
      const { lat, lng } = e.latlng;
      points.push([lat, lng]);

      if (currentDrawRef.current) {
        try { currentDrawRef.current.remove(); } catch {}
      }

      if (shapeType === 'rectangle') {
        if (points.length === 1) {
          const marker = L.circleMarker([lat, lng], { radius: 6, color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.8 }).addTo(mapInstance);
          currentDrawRef.current = marker;
        } else if (points.length >= 2) {
          const bounds = L.latLngBounds([points[0], points[1]]);
          const rect = L.rectangle(bounds, { color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.2 }).addTo(mapInstance);
          currentDrawRef.current = rect;

          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          const coords = [
            [sw.lng, sw.lat],
            [ne.lng, sw.lat],
            [ne.lng, ne.lat],
            [sw.lng, ne.lat],
            [sw.lng, sw.lat],
          ];
          const center = bounds.getCenter();
          setPendingZone({ coords: [coords], center: { lat: center.lat, lng: center.lng } });
          mapInstance.off('click', onMapClick);
        }
      } else {
        // Polygon click points
        if (points.length === 1) {
          const marker = L.circleMarker([lat, lng], { radius: 6, color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.8 }).addTo(mapInstance);
          currentDrawRef.current = marker;
        } else {
          const poly = L.polygon(points, { color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.2 }).addTo(mapInstance);
          currentDrawRef.current = poly;

          if (points.length >= 3) {
            const coords = points.map((p) => [p[1], p[0]]);
            coords.push(coords[0]);
            const bounds = poly.getBounds();
            const center = bounds.getCenter();
            setPendingZone({ coords: [coords], center: { lat: center.lat, lng: center.lng } });
          }
        }
      }
    };

    mapInstance.on('click', onMapClick);
    activeDrawHandlerRef.current = { disable: () => mapInstance.off('click', onMapClick) };
  };

  // Activate draw mode
  const startDrawing = (shapeType: 'polygon' | 'rectangle') => {
    if (!mapInstance || !LInstance) return;
    const L = LInstance;
    setDrawingMode(true);
    setActiveDrawShape(shapeType);
    setPendingZone(null);

    if (activeDrawHandlerRef.current) {
      try { activeDrawHandlerRef.current.disable(); } catch {}
      activeDrawHandlerRef.current = null;
    }

    if (currentDrawRef.current) {
      try { currentDrawRef.current.remove(); } catch {}
      currentDrawRef.current = null;
    }

    const DrawControl = (L as any).Draw || (window as any).L?.Draw;

    if (shapeType === 'polygon' && DrawControl?.Polygon) {
      try {
        const polygon = new DrawControl.Polygon(mapInstance, {
          shapeOptions: { color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.2 },
        });
        polygon.enable();
        activeDrawHandlerRef.current = polygon;
        return;
      } catch (err) {
        console.warn('Leaflet.Draw polygon init failed, using map click fallback:', err);
      }
    }

    if (shapeType === 'rectangle' && DrawControl?.Rectangle) {
      try {
        const rectangle = new DrawControl.Rectangle(mapInstance, {
          shapeOptions: { color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.2 },
        });
        rectangle.enable();
        activeDrawHandlerRef.current = rectangle;
        return;
      } catch (err) {
        console.warn('Leaflet.Draw rectangle init failed, using map click fallback:', err);
      }
    }

    // Interactive map click drawing fallback
    setupClickToDrawFallback(shapeType);
  };

  const cancelDrawing = () => {
    setPendingZone(null);
    setDrawingMode(false);
    setActiveDrawShape(null);
    if (activeDrawHandlerRef.current) {
      try { activeDrawHandlerRef.current.disable(); } catch {}
      activeDrawHandlerRef.current = null;
    }
    if (currentDrawRef.current) {
      try { currentDrawRef.current.remove(); } catch {}
      currentDrawRef.current = null;
    }
  };

  const handleSaveZone = () => {
    if (!pendingZone || !formData.name.trim()) return;
    createMutation.mutate({
      name: formData.name,
      type: formData.type,
      description: formData.description,
      coordinates: pendingZone.coords,
      centerLat: pendingZone.center.lat,
      centerLng: pendingZone.center.lng,
    });
  };

  return (
    <div className="flex h-[calc(100vh-72px)] overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div className="w-80 flex flex-col bg-white border-r border-slate-200 overflow-hidden flex-shrink-0">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Geofence Zones</h2>
              <p className="text-[10px] text-slate-400 font-medium">{zones?.length || 0} zones defined</p>
            </div>
          </div>
          {user?.role === 'admin' && (
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => startDrawing('polygon')}
                className={`p-2 rounded-xl border transition-all ${
                  drawingMode && activeDrawShape === 'polygon'
                    ? 'bg-amber-100 border-amber-300 text-amber-800'
                    : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                }`}
                title="Draw Custom Polygon (Freeform)"
              >
                <Hexagon className="w-4 h-4" />
              </button>
              <button
                onClick={() => startDrawing('rectangle')}
                className={`p-2 rounded-xl border transition-all ${
                  drawingMode && activeDrawShape === 'rectangle'
                    ? 'bg-amber-100 border-amber-300 text-amber-800'
                    : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                }`}
                title="Draw Quick Rectangle"
              >
                <Square className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Breach Alert */}
        {recentBreach && (
          <div className={`mx-3 mt-3 rounded-xl p-3 flex items-start gap-2.5 border ${
            recentBreach.zoneType === 'HIGH_SECURITY'
              ? 'bg-red-50 border-red-200'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${recentBreach.zoneType === 'HIGH_SECURITY' ? 'text-red-600' : 'text-amber-600'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900">Zone Breached!</p>
              <p className="text-[10px] text-slate-600">{recentBreach.suspectLabel} → {recentBreach.zoneName}</p>
            </div>
          </div>
        )}

        {/* Draw form */}
        {pendingZone && (
          <div className="mx-3 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2.5">
            <p className="text-xs font-bold text-amber-900">New Zone — Fill Details</p>
            <input
              className="w-full text-xs border border-amber-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Zone name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <select
              className="w-full text-xs border border-amber-300 rounded-lg px-3 py-2 bg-white focus:outline-none"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="WATCH">Watch Area</option>
              <option value="RESTRICTED">Restricted Zone</option>
              <option value="HIGH_SECURITY">High Security Zone</option>
            </select>
            <input
              className="w-full text-xs border border-amber-300 rounded-lg px-3 py-2 bg-white focus:outline-none"
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveZone}
                disabled={!formData.name.trim() || createMutation.isPending}
                className="flex-1 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? 'Saving...' : 'Save Zone'}
              </button>
              <button
                onClick={cancelDrawing}
                className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Zone List */}
        <div className="flex-1 overflow-y-auto">
          {/* Instructions when no zones */}
          {(!zones || zones.length === 0) && (
            <div className="flex flex-col items-center justify-center h-40 text-center px-6 gap-2">
              <Shield className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-semibold text-slate-400">No zones yet</p>
              <p className="text-xs text-slate-400">Click + to draw a polygon zone on the map</p>
            </div>
          )}

          {/* Drawing instructions */}
          {drawingMode && !pendingZone && (
            <div className="mx-3 mt-3 rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
              <p className="font-bold mb-1">Drawing Mode Active</p>
              <p>
                {activeDrawShape === 'polygon'
                  ? 'Click on the map to place polygon vertices. Double-click to close the shape.'
                  : 'Click and drag on the map to draw a rectangular zone.'}
              </p>
            </div>
          )}

          {zones?.map((zone) => {
            const color = ZONE_COLORS[zone.type] || '#3b82f6';
            return (
              <div key={zone.zoneId} className="px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-2.5">
                  <div className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800 truncate">{zone.name}</p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {user?.role === 'admin' && (
                          <>
                            <button
                              onClick={() => {
                                setScanningZone(zone);
                                setSelectedSuspectId('');
                                setScanResult(null);
                                setScanModalOpen(true);
                              }}
                              className="p-1 rounded hover:bg-blue-50 text-blue-600 transition-colors"
                              title="Scan Zone for Suspect"
                            >
                              <Radar className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleMutation.mutate(zone.zoneId)}
                              className="p-1 rounded hover:bg-slate-200 transition-colors"
                              title={zone.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {zone.isActive
                                ? <ToggleRight className="w-4 h-4 text-emerald-600" />
                                : <ToggleLeft className="w-4 h-4 text-slate-400" />
                              }
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(zone.zoneId)}
                              className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors"
                              title="Delete zone"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] font-semibold mt-0.5" style={{ color }}>
                      {zone.type.replace('_', ' ')}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5">{ZONE_DESCRIPTIONS[zone.type]}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className={`text-[9px] font-bold uppercase ${zone.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {zone.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {zone.totalBreaches || 0} breach{(zone.totalBreaches || 0) !== 1 ? 'es' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-slate-200 space-y-1.5">
          {Object.entries(ZONE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-[10px] text-slate-500 font-medium">{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Map ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Map Instructions overlay */}
        {drawingMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/95 backdrop-blur text-white text-xs font-semibold px-4 py-2 rounded-full border border-slate-700">
            {activeDrawShape === 'polygon'
              ? 'Click to place polygon vertices • Double-click to finish'
              : 'Click and drag to draw a rectangle'}
          </div>
        )}
      </div>

      <Modal
        isOpen={scanModalOpen}
        onClose={() => {
          setScanModalOpen(false);
          setScanningZone(null);
          setSelectedSuspectId('');
          setScanResult(null);
        }}
        title={`Scan Zone: ${scanningZone?.name || ''}`}
        footer={
          <div className="flex gap-2 w-full justify-end">
            <button
              onClick={() => {
                setScanModalOpen(false);
                setScanningZone(null);
                setSelectedSuspectId('');
                setScanResult(null);
              }}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            {!scanResult && (
              <button
                onClick={handleStartScan}
                disabled={!selectedSuspectId || isScanning}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {isScanning ? 'Starting Scan...' : 'Start Scan'}
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            This will automatically locate all active CCTV cameras inside this geofenced region and start scanning them for the selected target suspect.
          </p>

          {!scanResult ? (
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Select Suspect Target
              </label>
              <select
                value={selectedSuspectId}
                onChange={(e) => setSelectedSuspectId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none hover:border-slate-300"
              >
                <option value="">-- Choose Target Suspect --</option>
                {suspectList.map((suspect) => (
                  <option key={suspect.id} value={suspect.id}>
                    {suspect.label} ({suspect.type === 'KNOWN' ? 'Known' : 'Unknown'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              {scanResult.error ? (
                <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-red-700 text-xs font-semibold">
                  Scan Failed: {scanResult.error}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 text-xs font-bold">
                    Successfully triggered target scan on {scanResult.triggeredCount} CCTV camera(s) inside the geofence boundary!
                  </div>
                  {scanResult.errors && scanResult.errors.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Errors / Skip Logs</p>
                      <div className="max-h-24 overflow-y-auto text-[10px] text-slate-500 space-y-1">
                        {scanResult.errors.map((err: string, i: number) => (
                          <div key={i} className="px-2 py-1 bg-slate-50 rounded">
                            {err}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default GeofenceManager;
