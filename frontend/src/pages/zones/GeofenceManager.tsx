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

import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Shield, Trash2, ToggleLeft, ToggleRight, Plus, AlertTriangle } from 'lucide-react';
import api from '../../api';
import socket from '../../socket';
import { useAuthStore } from '../../store/auth';

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
  const drawControlRef = useRef<any>(null);
  const currentDrawRef = useRef<any>(null);

  const [drawingMode, setDrawingMode] = useState(false);
  const [pendingZone, setPendingZone] = useState<{ coords: number[][][]; center: { lat: number; lng: number } } | null>(null);
  const [formData, setFormData] = useState({ name: '', type: 'WATCH', description: '' });
  const [recentBreach, setRecentBreach] = useState<any>(null);

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
    let L: any;

    Promise.all([
      import('leaflet'),
      import('leaflet-draw' as any).catch(() => null),
    ]).then(([LMod]) => {
      L = LMod;
      leafletRef.current = L;
      if (mapRef.current) return;

      const map = L.map(mapContainerRef.current!, { center: [12.9141, 74.856], zoom: 13 });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB', maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

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

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Render zones on map
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current || !zones) return;
    const L = leafletRef.current;

    // Remove old zone layers
    zoneLayersRef.current.forEach((layer) => { try { layer.remove(); } catch {} });
    zoneLayersRef.current.clear();

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
        .addTo(mapRef.current)
        .bindPopup(`
          <div style="min-width:160px;padding:4px">
            <b style="color:${color}">${zone.name}</b><br/>
            <span style="font-size:11px">${zone.type.replace('_', ' ')}</span><br/>
            <span style="font-size:10px;color:#94a3b8">Breaches: ${zone.totalBreaches || 0}</span><br/>
            <span style="font-size:10px;color:${zone.isActive ? '#10b981' : '#64748b'}">${zone.isActive ? '● Active' : '○ Inactive'}</span>
          </div>
        `);

      // Label
      if (zone.centerLat && zone.centerLng) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${color}22;border:1px solid ${color}55;border-radius:6px;padding:2px 6px;font-size:10px;font-weight:700;color:${color};white-space:nowrap">${zone.name}</div>`,
          iconAnchor: [50, 10],
        });
        L.marker([zone.centerLat, zone.centerLng], { icon }).addTo(mapRef.current);
      }

      zoneLayersRef.current.set(zone.zoneId, polygon);
    });
  }, [zones]);

  // Activate draw mode
  const startDrawing = () => {
    if (!mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    setDrawingMode(true);
    setPendingZone(null);

    // Use built-in Leaflet draw if available, otherwise guide with instructions
    if ((L as any).Draw) {
      const polygon = new (L as any).Draw.Polygon(mapRef.current, {
        shapeOptions: { color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.2 },
      });
      polygon.enable();
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
            <button
              onClick={startDrawing}
              className="p-2 rounded-xl bg-slate-900 text-white hover:bg-slate-700 transition-colors"
              title="Draw new zone"
            >
              <Plus className="w-4 h-4" />
            </button>
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
                onClick={() => { setPendingZone(null); setDrawingMode(false); if (currentDrawRef.current) try { currentDrawRef.current.remove(); } catch {} }}
                className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
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
              <p>Click on the map to place polygon vertices. Double-click to close the shape.</p>
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
                        {zone.isActive ? '● Active' : '○ Inactive'}
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
            🎯 Click to place polygon vertices • Double-click to finish
          </div>
        )}
      </div>
    </div>
  );
};

export default GeofenceManager;
