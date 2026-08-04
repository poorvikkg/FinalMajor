/**
 * SuspectChaseMap.tsx
 * Real-time CCTV Relay Chase Map — shows suspect tracking across the camera network.
 *
 * Features:
 *  - Full-page Leaflet map with all city cameras
 *  - Camera pins pulse RED when alerted, glow GOLD when confirmed
 *  - Animated polyline traces the relay chain through the city
 *  - Live sidebar shows alert details, relay hops, and elapsed time
 *  - Socket.IO driven: no polling needed
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Radio,
  ShieldAlert,
  MapPin,
  Clock,
  Camera,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Activity,
  XCircle,
} from 'lucide-react';
import api from '../../api';
import socket from '../../socket';
import { useAuthStore } from '../../store/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RelayHop {
  cameraId: string;
  cameraName: string;
  locationName: string;
  latitude: number;
  longitude: number;
  detectedAt: string;
  similarity: number;
  hopIndex: number;
  snapshotObjectKey?: string;
}

interface SuspectAlert {
  _id: string;
  alertId: string;
  suspectType: 'KNOWN' | 'UNKNOWN';
  suspectLabel: string;
  status: 'ACTIVE' | 'RESOLVED' | 'EXPIRED';
  originCameraId: any;
  lastDetectedCameraId: any;
  alertedCameraIds: any[];
  confirmedCameraIds: any[];
  relayChain: RelayHop[];
  triggerSimilarity: number;
  snapshotObjectKey?: string;
  expiresAt: string;
  createdAt: string;
}

interface CameraPin {
  _id: string;
  name: string;
  status: string;
  location: { name: string; latitude: number; longitude: number };
  activeAlerts?: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatElapsed(from: string): string {
  const ms = Date.now() - new Date(from).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Component ───────────────────────────────────────────────────────────────

export const SuspectChaseMap: React.FC = () => {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const polylineRef = useRef<any>(null);
  const alertedMarkersRef = useRef<Map<string, any>>(new Map());
  const leafletRef = useRef<any>(null);

  const [selectedAlert, setSelectedAlert] = useState<SuspectAlert | null>(null);
  const [liveActivity, setLiveActivity] = useState<{ text: string; time: Date }[]>([]);
  const [elapsed, setElapsed] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const zoneLayersRefMap = useRef<Map<string, any>>(new Map());
  const predictionMarkersRef = useRef<any[]>([]);

  // Fetch all active alerts
  const { data: alertsData } = useQuery({
    queryKey: ['suspect-alerts', 'ACTIVE'],
    queryFn: async () => {
      const res = await api.get('/suspect-alerts?status=ACTIVE&limit=50');
      return res.data.data as SuspectAlert[];
    },
    refetchInterval: 30000,
  });

  // Fetch all cameras
  const { data: cameras } = useQuery({
    queryKey: ['cameras-map'],
    queryFn: async () => {
      const res = await api.get('/cameras?limit=200');
      return res.data.data as CameraPin[];
    },
  });

  // Fetch prediction for selected alert
  const { data: prediction } = useQuery({
    queryKey: ['prediction', selectedAlert?.alertId],
    queryFn: async () => {
      if (!selectedAlert) return null;
      try {
        const res = await api.get(`/analytics/prediction/${selectedAlert.alertId}`);
        return res.data.data;
      } catch {
        return null;
      }
    },
    enabled: !!selectedAlert,
    refetchInterval: 15000,
  });

  // Fetch geofence zones
  const { data: zones } = useQuery({
    queryKey: ['zones-overlay'],
    queryFn: async () => {
      const res = await api.get('/zones?activeOnly=true');
      return res.data.data as any[];
    },
  });

  // Auto-select the first active alert
  useEffect(() => {
    if (alertsData && alertsData.length > 0 && !selectedAlert) {
      setSelectedAlert(alertsData[0]);
    }
  }, [alertsData, selectedAlert]);

  // Elapsed timer
  useEffect(() => {
    if (!selectedAlert) return;
    const tick = () => setElapsed(formatElapsed(selectedAlert.createdAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [selectedAlert]);

  // Add live activity log entry
  const addActivity = useCallback((text: string) => {
    setLiveActivity((prev) => [{ text, time: new Date() }, ...prev].slice(0, 20));
  }, []);

  // ─── Initialize Leaflet map ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;

    import('leaflet').then((L) => {
      leafletRef.current = L;

      if (mapRef.current) return; // already initialized

      // Dark map tiles
      const map = L.map(mapContainerRef.current!, {
        center: [12.9141, 74.856],
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; OpenStreetMap &copy; CartoDB',
          maxZoom: 19,
        }
      ).addTo(map);

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // ─── Render cameras on map ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current || !cameras) return;
    const L = leafletRef.current;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    cameras.forEach((cam) => {
      const lat = cam.location?.latitude;
      const lng = cam.location?.longitude;
      if (!lat || !lng || (lat === 0 && lng === 0)) return;

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:28px;height:28px;border-radius:50%;
          background:${cam.status === 'online' ? '#10b981' : '#64748b'};
          border:2px solid rgba(255,255,255,0.2);
          display:flex;align-items:center;justify-content:center;
          font-size:10px;color:white;font-weight:bold;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
          cursor:pointer;
        ">▤</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([lat, lng], { icon })
        .addTo(mapRef.current)
        .bindPopup(`<b>${cam.name}</b><br/>${cam.location.name}<br/><em>${cam.status}</em>`);

      markersRef.current.set(cam._id, marker);
    });
  }, [cameras]);

    // Remove old alert markers
    alertedMarkersRef.current.forEach((m) => m.remove());
    alertedMarkersRef.current.clear();
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    predictionMarkersRef.current.forEach((m) => m.remove());
    predictionMarkersRef.current = [];

    // Draw confirmed relay chain trail
    const chainCoords = selectedAlert.relayChain.map((h) => [h.latitude, h.longitude] as [number, number]);
    if (chainCoords.length >= 2) {
      // Glow trail
      L.polyline(chainCoords, {
        color: '#f59e0b',
        weight: 4,
        opacity: 0.9,
        dashArray: '8 6',
      }).addTo(mapRef.current);

      polylineRef.current = L.polyline(chainCoords, {
        color: '#fbbf24',
        weight: 2,
        opacity: 0.6,
      }).addTo(mapRef.current);
    }

    // Confirmed hop markers (gold)
    selectedAlert.relayChain.forEach((hop, i) => {
      if (!hop.latitude || !hop.longitude) return;
      const isOrigin = i === 0;
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${isOrigin ? 44 : 36}px;
          height:${isOrigin ? 44 : 36}px;
          border-radius:50%;
          background:linear-gradient(135deg,#f59e0b,#d97706);
          border:3px solid #fbbf24;
          display:flex;align-items:center;justify-content:center;
          font-size:11px;font-weight:900;color:white;
          box-shadow:0 0 20px rgba(245,158,11,0.7),0 0 40px rgba(245,158,11,0.3);
          cursor:pointer;
          animation:pulse-gold 1.5s infinite;
        ">${hop.hopIndex + 1}</div>`,
        iconSize: [isOrigin ? 44 : 36, isOrigin ? 44 : 36],
        iconAnchor: [isOrigin ? 22 : 18, isOrigin ? 22 : 18],
      });

      const m = L.marker([hop.latitude, hop.longitude], { icon })
        .addTo(mapRef.current)
        .bindPopup(`
          <div style="min-width:180px">
            <b>Hop #${hop.hopIndex + 1} ${isOrigin ? '(Origin)' : ''}</b><br/>
            📷 ${hop.cameraName}<br/>
            📍 ${hop.locationName}<br/>
            🎯 ${(hop.similarity * 100).toFixed(1)}% match<br/>
            🕒 ${new Date(hop.detectedAt).toLocaleTimeString()}
          </div>
        `);

      alertedMarkersRef.current.set(`hop-${i}`, m);
    });

    // Alerted (watching) cameras — pulsing red
    if (Array.isArray(selectedAlert.alertedCameraIds)) {
      selectedAlert.alertedCameraIds.forEach((cam: any) => {
        const camObj = typeof cam === 'object' ? cam : cameras?.find((c) => c._id === cam);
        if (!camObj) return;
        const lat = camObj.location?.latitude ?? 0;
        const lng = camObj.location?.longitude ?? 0;
        if (!lat || !lng) return;

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:38px;height:38px;border-radius:50%;
            background:linear-gradient(135deg,#ef4444,#dc2626);
            border:3px solid #fca5a5;
            display:flex;align-items:center;justify-content:center;
            font-size:14px;color:white;
            box-shadow:0 0 20px rgba(239,68,68,0.8),0 0 40px rgba(239,68,68,0.4);
            animation:pulse-red 1s infinite;
          ">👁</div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });

        const m = L.marker([lat, lng], { icon })
          .addTo(mapRef.current)
          .bindPopup(`<b>⚠ ALERTED: ${camObj.name || 'Camera'}</b><br/>Watching for suspect`);

        alertedMarkersRef.current.set(`alerted-${camObj._id}`, m);
      });
    }

    // Predictive trajectory cameras - purple pulsing
    if (prediction && prediction.cameras) {
      prediction.cameras.forEach((predCam: any) => {
        const lat = predCam.location?.latitude;
        const lng = predCam.location?.longitude;
        if (!lat || !lng) return;

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:38px;height:38px;border-radius:50%;
            background:linear-gradient(135deg,#a855f7,#7c3aed);
            border:3px solid #c084fc;
            display:flex;align-items:center;justify-content:center;
            font-size:14px;color:white;
            box-shadow:0 0 20px rgba(168,85,247,0.8),0 0 40px rgba(168,85,247,0.4);
            animation:pulse-purple 1.2s infinite;
          ">🔮</div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });

        const m = L.marker([lat, lng], { icon })
          .addTo(mapRef.current)
          .bindPopup(`<b>🔮 PREDICTED NEXT: ${predCam.name}</b><br/>Suspect direction projection`);

        predictionMarkersRef.current.push(m);
      });

      if (prediction.predictedLat && prediction.predictedLng && chainCoords.length > 0) {
        const lastCoords = chainCoords[chainCoords.length - 1];
        const predLine = L.polyline([lastCoords, [prediction.predictedLat, prediction.predictedLng]], {
          color: '#a855f7',
          weight: 2,
          opacity: 0.7,
          dashArray: '4 4',
        }).addTo(mapRef.current);
        predictionMarkersRef.current.push(predLine);
      }
    }

    // Pan map to latest detection
    if (selectedAlert.relayChain.length > 0) {
      const last = selectedAlert.relayChain[selectedAlert.relayChain.length - 1];
      if (last.latitude && last.longitude) {
        mapRef.current.panTo([last.latitude, last.longitude]);
      }
    }
  }, [selectedAlert, cameras, prediction]);

  // ─── Render zones on map ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current || !zones) return;
    const L = leafletRef.current;

    zoneLayersRefMap.current.forEach((layer) => {
      try {
        layer.remove();
      } catch {}
    });
    zoneLayersRefMap.current.clear();

    const colors: Record<string, string> = {
      HIGH_SECURITY: '#ef4444',
      RESTRICTED: '#f59e0b',
      WATCH: '#3b82f6',
    };

    zones.forEach((zone) => {
      if (!zone.boundary?.coordinates) return;
      const color = colors[zone.type] || '#3b82f6';
      
      const polygon = L.geoJSON(zone.boundary, {
        style: {
          color,
          fillColor: color,
          fillOpacity: 0.15,
          weight: 1.5,
        },
      })
        .addTo(mapRef.current)
        .bindPopup(`<b>${zone.name}</b><br/>Type: ${zone.type}`);
        
      zoneLayersRefMap.current.set(zone.zoneId, polygon);
    });
  }, [zones]);

  // ─── Socket.IO listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const handleNewAlert = (data: any) => {
      addActivity(`🚨 New alert: ${data.suspectLabel} detected at ${data.originCamera?.name || 'unknown camera'}`);
      queryClient.invalidateQueries({ queryKey: ['suspect-alerts'] });
      if (!selectedAlert) setSelectedAlert(data as any);
    };

    const handleUpdated = (data: any) => {
      addActivity(`📡 Relay hop — suspect seen at ${data.lastDetectedCamera?.name || 'unknown camera'}`);
      queryClient.invalidateQueries({ queryKey: ['suspect-alerts'] });
      if (selectedAlert && selectedAlert.alertId === data.alertId) {
        setSelectedAlert((prev) =>
          prev ? { ...prev, relayChain: data.relayChain, alertedCameraIds: data.alertedCameras } : prev
        );
      }
    };

    const handleResolved = (data: any) => {
      addActivity(`✅ Alert ${data.alertId} resolved: ${data.reason}`);
      queryClient.invalidateQueries({ queryKey: ['suspect-alerts'] });
      if (selectedAlert?.alertId === data.alertId) {
        setSelectedAlert((prev) => (prev ? { ...prev, status: 'RESOLVED' } : prev));
      }
    };

    socket.on('suspect:relay:alert', handleNewAlert);
    socket.on('suspect:relay:updated', handleUpdated);
    socket.on('suspect:relay:resolved', handleResolved);

    return () => {
      socket.off('suspect:relay:alert', handleNewAlert);
      socket.off('suspect:relay:updated', handleUpdated);
      socket.off('suspect:relay:resolved', handleResolved);
    };
  }, [selectedAlert, queryClient, addActivity]);

  // ─── Resolve alert handler ────────────────────────────────────────────────
  const handleResolve = async () => {
    if (!selectedAlert || user?.role !== 'admin') return;
    try {
      await api.post(`/suspect-alerts/${selectedAlert.alertId}/resolve`, {
        reason: 'Manually resolved by operator',
      });
      addActivity(`✅ Resolved alert ${selectedAlert.alertId}`);
    } catch (err) {
      console.error('Failed to resolve alert', err);
    }
  };

  // ─── Distance covered ─────────────────────────────────────────────────────
  const distanceCovered = (() => {
    const chain = selectedAlert?.relayChain || [];
    if (chain.length < 2) return '0 km';
    let total = 0;
    for (let i = 1; i < chain.length; i++) {
      total += haversineKm(
        chain[i - 1].latitude, chain[i - 1].longitude,
        chain[i].latitude, chain[i].longitude
      );
    }
    return `${total.toFixed(2)} km`;
  })();

  return (
    <div className="flex h-[calc(100vh-72px)] overflow-hidden bg-slate-950">
      {/* ── CSS animations injected globally ──────────────────────────────── */}
      <style>{`
        @keyframes pulse-red {
          0%, 100% { box-shadow: 0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4); transform: scale(1); }
          50% { box-shadow: 0 0 30px rgba(239,68,68,1), 0 0 60px rgba(239,68,68,0.6); transform: scale(1.15); }
        }
        @keyframes pulse-gold {
          0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,0.7), 0 0 40px rgba(245,158,11,0.3); }
          50% { box-shadow: 0 0 35px rgba(245,158,11,1), 0 0 70px rgba(245,158,11,0.5); }
        }
        @keyframes pulse-purple {
          0%, 100% { box-shadow: 0 0 20px rgba(168,85,247,0.8), 0 0 40px rgba(168,85,247,0.4); transform: scale(1); }
          50% { box-shadow: 0 0 30px rgba(168,85,247,1), 0 0 60px rgba(168,85,247,0.6); transform: scale(1.15); }
        }
        @keyframes scan-line {
          0% { transform: translateY(-100%); opacity: 0.6; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        .alert-active { animation: pulse-red 1.5s ease-in-out infinite; }
        .leaflet-container { background: #0f172a !important; }
      `}</style>

      {/* ─── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
      <div className="w-80 flex flex-col bg-slate-900 border-r border-slate-800 overflow-hidden flex-shrink-0">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center">
              <Radio className="w-5 h-5 text-white" />
            </div>
            {(alertsData?.length ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-bounce">
                {alertsData?.length}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Relay Chase Network</h2>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              Live Suspect Tracking
            </p>
          </div>
        </div>

        {/* Active Alerts List */}
        <div className="px-4 py-3 border-b border-slate-800">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider">Active Alerts</p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {(alertsData?.length ?? 0) === 0 ? (
              <div className="text-center py-3 text-slate-500 text-xs">No active alerts</div>
            ) : (
              alertsData?.map((a) => (
                <button
                  key={a.alertId}
                  onClick={() => setSelectedAlert(a)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    selectedAlert?.alertId === a.alertId
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{a.suspectLabel}</span>
                    <span className="text-[9px] opacity-70 shrink-0 ml-2">{a.relayChain.length} hops</span>
                  </div>
                  <span className="text-[9px] opacity-60">{a.alertId}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected Alert Details */}
        {selectedAlert ? (
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                  selectedAlert.status === 'ACTIVE'
                    ? 'bg-red-900/50 text-red-400 border border-red-800'
                    : selectedAlert.status === 'RESOLVED'
                    ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {selectedAlert.status === 'ACTIVE' && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse" />
                )}
                {selectedAlert.status}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">{selectedAlert.alertId}</span>
            </div>

            {/* Suspect Info */}
            <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-600 flex-shrink-0">
                  {selectedAlert.snapshotObjectKey ? (
                    <img
                      src={`${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'}/snapshot/${selectedAlert.snapshotObjectKey}`}
                      alt="suspect"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-slate-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{selectedAlert.suspectLabel}</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {selectedAlert.suspectType === 'KNOWN' ? '🔴 Known Missing Person' : '🟡 Unknown Recurring Person'}
                  </p>
                  <p className="text-[10px] text-amber-400 font-semibold mt-0.5">
                    {(selectedAlert.triggerSimilarity * 100).toFixed(1)}% confidence
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700 text-center">
                <p className="text-lg font-black text-amber-400">{selectedAlert.relayChain.length}</p>
                <p className="text-[9px] text-slate-500 uppercase font-semibold">Hops</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700 text-center">
                <p className="text-lg font-black text-red-400">{selectedAlert.alertedCameraIds?.length ?? 0}</p>
                <p className="text-[9px] text-slate-500 uppercase font-semibold">Alerted</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700 text-center">
                <p className="text-xs font-black text-slate-300">{distanceCovered}</p>
                <p className="text-[9px] text-slate-500 uppercase font-semibold">Distance</p>
              </div>
            </div>

            {/* Time Info */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Started {elapsed}</span>
              <span className="ml-auto text-[10px] text-slate-600">
                Expires {new Date(selectedAlert.expiresAt).toLocaleTimeString()}
              </span>
            </div>

            {/* Relay Chain Timeline */}
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider flex items-center gap-1.5">
                <Activity className="w-3 h-3" /> Relay Chain
              </p>
              <div className="space-y-2">
                {selectedAlert.relayChain.map((hop, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    {/* Step indicator */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                          i === 0
                            ? 'bg-red-600 text-white'
                            : 'bg-amber-500 text-slate-900'
                        }`}
                      >
                        {hop.hopIndex + 1}
                      </div>
                      {i < selectedAlert.relayChain.length - 1 && (
                        <div className="w-px h-4 bg-slate-700 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <p className="text-xs font-semibold text-white truncate">{hop.cameraName}</p>
                      <p className="text-[10px] text-slate-500 truncate">{hop.locationName}</p>
                      <p className="text-[10px] text-amber-400">{(hop.similarity * 100).toFixed(1)}% • {new Date(hop.detectedAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerted Cameras */}
            {selectedAlert.alertedCameraIds?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3 text-red-500" /> On Watch
                </p>
                <div className="space-y-1">
                  {selectedAlert.alertedCameraIds.slice(0, 5).map((cam: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-red-900/20 border border-red-900/30 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                      <span className="text-[11px] text-red-300 truncate">
                        {cam.name || `Camera ${i + 1}`}
                      </span>
                    </div>
                  ))}
                  {selectedAlert.alertedCameraIds.length > 5 && (
                    <p className="text-[10px] text-slate-500 text-center">+{selectedAlert.alertedCameraIds.length - 5} more</p>
                  )}
                </div>
              </div>
            )}

            {/* Resolve Button */}
            {user?.role === 'admin' && selectedAlert.status === 'ACTIVE' && (
              <button
                onClick={handleResolve}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                Resolve Alert
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-3">
              <Radio className="w-7 h-7 text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-400">No Active Alerts</p>
            <p className="text-xs text-slate-600 mt-1">
              When a suspect is detected on a camera, the relay chase will appear here in real-time.
            </p>
          </div>
        )}
      </div>

      {/* ─── MAP AREA ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col relative">
        {/* Legend Bar */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-4 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-full px-5 py-2 text-[10px] font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            <span className="text-slate-300">Online</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block animate-pulse" />
            <span className="text-slate-300">ALERTED</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            <span className="text-slate-300">Confirmed</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-amber-400 inline-block" style={{ borderTop: '2px dashed #f59e0b' }} />
            <span className="text-slate-300">Trail</span>
          </span>
        </div>

        {/* Camera Count Badge */}
        <div className="absolute top-3 right-3 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
          <Camera className="w-3 h-3 text-slate-500" />
          {cameras?.length ?? 0} cameras
          {(alertsData?.length ?? 0) > 0 && (
            <span className="ml-2 text-red-400">{alertsData!.length} active alerts</span>
          )}
        </div>

        <div ref={mapContainerRef} className="flex-1 w-full" style={{ minHeight: '400px' }} />

        {/* Live Activity Feed */}
        <div className="absolute bottom-3 left-3 z-[1000] w-72 max-h-36 overflow-hidden">
          {liveActivity.length > 0 && (
            <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl p-3 space-y-1.5">
              <p className="text-[9px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live Feed
              </p>
              {liveActivity.slice(0, 4).map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[9px] text-slate-500 shrink-0 mt-0.5 font-mono">
                    {a.time.toLocaleTimeString()}
                  </span>
                  <span className="text-[10px] text-slate-300 leading-tight">{a.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── RIGHT: Alert List Slim Panel ─────────────────────────────────── */}
      <div className="w-64 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden flex-shrink-0">
        <div className="px-4 py-3 border-b border-slate-800">
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">All Alerts</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {(alertsData?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-4">
              <XCircle className="w-6 h-6 text-slate-700 mb-2" />
              <p className="text-xs text-slate-600">No alerts yet</p>
            </div>
          ) : (
            alertsData?.map((a) => (
              <button
                key={a.alertId}
                onClick={() => setSelectedAlert(a)}
                className={`w-full text-left px-4 py-3 border-b border-slate-800/50 transition-colors ${
                  selectedAlert?.alertId === a.alertId ? 'bg-red-950/50' : 'hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    a.status === 'ACTIVE' ? 'bg-red-500 animate-pulse' :
                    a.status === 'RESOLVED' ? 'bg-emerald-500' : 'bg-slate-500'
                  }`} />
                  <span className="text-xs font-bold text-white truncate">{a.suspectLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-500 font-mono">{a.alertId}</span>
                  <span className="text-[9px] text-amber-500 font-semibold">{a.relayChain.length} hops</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="w-2.5 h-2.5 text-slate-600" />
                  <span className="text-[9px] text-slate-600 truncate">
                    {typeof a.originCameraId === 'object'
                      ? a.originCameraId?.name
                      : 'Camera'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Quick Stats */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">Active</span>
            <span className="font-bold text-red-400">{alertsData?.filter(a => a.status === 'ACTIVE').length ?? 0}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">Cameras Alerted</span>
            <span className="font-bold text-slate-300">
              {alertsData?.reduce((sum, a) => sum + (a.alertedCameraIds?.length ?? 0), 0) ?? 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuspectChaseMap;
