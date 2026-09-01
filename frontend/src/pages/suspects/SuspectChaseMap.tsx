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
  frontierCameraIds: any[];   // cameras actively streaming, watching for suspect
  prunedCameraIds: any[];     // cameras stopped — suspect went a different direction
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
  const polylinesRef = useRef<any[]>([]);
  const alertedMarkersRef = useRef<Map<string, any>>(new Map());
  const leafletRef = useRef<any>(null);

  const [mapInstance, setMapInstance] = useState<any>(null);
  const [LInstance, setLInstance] = useState<any>(null);

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
      setLInstance(L);

      if (mapRef.current) return; // already initialized

      const map = L.map(mapContainerRef.current!, {
        center: [12.9141, 74.856],
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      setMapInstance(map);
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

  // ─── Render cameras on map ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance || !LInstance || !cameras) return;
    const L = LInstance;

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
          color:white;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
          cursor:pointer;
        "><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([lat, lng], { icon })
        .addTo(mapInstance)
        .bindPopup(`<b>${cam.name}</b><br/>${cam.location.name}<br/><em>${cam.status}</em>`);

      markersRef.current.set(cam._id, marker);
    });
  }, [cameras, mapInstance, LInstance]);

  useEffect(() => {
    if (!mapInstance || !LInstance || !selectedAlert) return;
    const L = LInstance;

    // Remove old alert markers
    alertedMarkersRef.current.forEach((m) => m.remove());
    alertedMarkersRef.current.clear();
    
    // Remove old polylines
    polylinesRef.current.forEach((line) => line.remove());
    polylinesRef.current = [];

    predictionMarkersRef.current.forEach((m) => m.remove());
    predictionMarkersRef.current = [];

    // Draw confirmed relay chain trail
    const chainCoords = selectedAlert.relayChain.map((h) => [h.latitude, h.longitude] as [number, number]);
    if (chainCoords.length >= 2) {
      // Glow trail
      const glowLine = L.polyline(chainCoords, {
        color: '#f59e0b',
        weight: 4,
        opacity: 0.9,
        dashArray: '8 6',
      }).addTo(mapInstance);

      const mainLine = L.polyline(chainCoords, {
        color: '#fbbf24',
        weight: 2,
        opacity: 0.6,
      }).addTo(mapInstance);

      polylinesRef.current = [glowLine, mainLine];
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
        .addTo(mapInstance)
        .bindPopup(`
          <div style="min-width:180px">
            <b>Hop #${hop.hopIndex + 1} ${isOrigin ? '(Origin)' : ''}</b><br/>
            Camera: ${hop.cameraName}<br/>
            Location: ${hop.locationName}<br/>
            Match: ${(hop.similarity * 100).toFixed(1)}% match<br/>
            Time: ${new Date(hop.detectedAt).toLocaleTimeString()}
          </div>
        `);

      alertedMarkersRef.current.set(`hop-${i}`, m);
    });

    // Alerted (watching) cameras — pulsing red (legacy alertedCameraIds support)
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
            color:white;
            box-shadow:0 0 20px rgba(239,68,68,0.8),0 0 40px rgba(239,68,68,0.4);
            animation:pulse-red 1s infinite;
          "><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg></div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });

        const m = L.marker([lat, lng], { icon })
          .addTo(mapInstance)
          .bindPopup(`<b>WATCHING: ${camObj.name || 'Camera'}</b><br/>Searching for suspect`);

        alertedMarkersRef.current.set(`alerted-${camObj._id}`, m);
      });
    }

    // ── FRONTIER cameras — pulsing RED (actively streaming, watching) ─────────
    const frontierList = selectedAlert.frontierCameraIds || [];
    if (Array.isArray(frontierList)) {
      frontierList.forEach((cam: any) => {
        const camObj = typeof cam === 'object' ? cam : cameras?.find((c) => c._id === cam);
        if (!camObj) return;
        const lat = camObj.location?.latitude ?? 0;
        const lng = camObj.location?.longitude ?? 0;
        if (!lat || !lng) return;

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:42px;height:42px;border-radius:50%;
            background:linear-gradient(135deg,#ef4444,#b91c1c);
            border:3px solid #fca5a5;
            display:flex;align-items:center;justify-content:center;
            color:white;
            box-shadow:0 0 24px rgba(239,68,68,0.9),0 0 48px rgba(239,68,68,0.5);
            animation:pulse-frontier 0.8s infinite;
            position:relative;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
            <span style="position:absolute;top:-6px;right:-6px;width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid white;animation:pulse-frontier 0.6s infinite"></span>
          </div>`,
          iconSize: [42, 42],
          iconAnchor: [21, 21],
        });

        const m = L.marker([lat, lng], { icon })
          .addTo(mapInstance)
          .bindPopup(`<b>🔴 FRONTIER: ${camObj.name || 'Camera'}</b><br/>LIVE STREAMING — Watching for suspect<br/><em>Stream active</em>`);

        alertedMarkersRef.current.set(`frontier-${camObj._id || camObj}`, m);
      });
    }

    // ── PRUNED cameras — grey ✕ (stopped — wrong direction) ─────────────────
    const prunedList = selectedAlert.prunedCameraIds || [];
    if (Array.isArray(prunedList)) {
      prunedList.forEach((cam: any) => {
        const camObj = typeof cam === 'object' ? cam : cameras?.find((c) => c._id === cam);
        if (!camObj) return;
        const lat = camObj.location?.latitude ?? 0;
        const lng = camObj.location?.longitude ?? 0;
        if (!lat || !lng) return;

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:28px;height:28px;border-radius:50%;
            background:#64748b;
            border:2px solid #94a3b8;
            display:flex;align-items:center;justify-content:center;
            color:#cbd5e1;
            opacity:0.6;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const m = L.marker([lat, lng], { icon })
          .addTo(mapInstance)
          .bindPopup(`<b>⚫ PRUNED: ${camObj.name || 'Camera'}</b><br/>Stream stopped — suspect moved away`);

        alertedMarkersRef.current.set(`pruned-${camObj._id || camObj}`, m);
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
            color:white;
            box-shadow:0 0 20px rgba(168,85,247,0.8),0 0 40px rgba(168,85,247,0.4);
            animation:pulse-purple 1.2s infinite;
          "><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });

        const m = L.marker([lat, lng], { icon })
          .addTo(mapInstance)
          .bindPopup(`<b>PREDICTED NEXT: ${predCam.name}</b><br/>Suspect direction projection`);

        predictionMarkersRef.current.push(m);
      });

      if (prediction.predictedLat && prediction.predictedLng && chainCoords.length > 0) {
        const lastCoords = chainCoords[chainCoords.length - 1];
        const predLine = L.polyline([lastCoords, [prediction.predictedLat, prediction.predictedLng]], {
          color: '#a855f7',
          weight: 2,
          opacity: 0.7,
          dashArray: '4 4',
        }).addTo(mapInstance);
        predictionMarkersRef.current.push(predLine);
      }
    }

    // Pan map to latest detection
    if (selectedAlert.relayChain.length > 0) {
      const last = selectedAlert.relayChain[selectedAlert.relayChain.length - 1];
      if (last.latitude && last.longitude) {
        mapInstance.panTo([last.latitude, last.longitude]);
      }
    }
  }, [selectedAlert, cameras, prediction, mapInstance, LInstance]);

  // ─── Render zones on map ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance || !LInstance || !zones) return;
    const L = LInstance;

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
        .addTo(mapInstance)
        .bindPopup(`<b>${zone.name}</b><br/>Type: ${zone.type}`);
        
      zoneLayersRefMap.current.set(zone.zoneId, polygon);
    });
  }, [zones, mapInstance, LInstance]);

  // ─── Socket.IO listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const handleNewAlert = (data: any) => {
      addActivity(`New alert: ${data.suspectLabel} detected at ${data.originCamera?.name || 'unknown camera'}`);
      queryClient.invalidateQueries({ queryKey: ['suspect-alerts'] });
      if (!selectedAlert) setSelectedAlert(data as any);
    };

    const handleUpdated = (data: any) => {
      addActivity(`Relay hop — suspect seen at ${data.lastDetectedCamera?.name || 'unknown camera'}`);
      queryClient.invalidateQueries({ queryKey: ['suspect-alerts'] });
      if (selectedAlert && selectedAlert.alertId === data.alertId) {
        setSelectedAlert((prev) =>
          prev ? {
            ...prev,
            relayChain: data.relayChain,
            alertedCameraIds: data.alertedCameras,
            frontierCameraIds: data.frontierCameras || [],
            prunedCameraIds: data.prunedCameras || [],
          } : prev
        );
      }
    };

    const handleResolved = (data: any) => {
      addActivity(`Alert ${data.alertId} resolved: ${data.reason}`);
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
      addActivity(`Resolved alert ${selectedAlert.alertId}`);
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
    <div className="flex h-[calc(100vh-72px)] overflow-hidden bg-white text-slate-900 relative">
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
        @keyframes pulse-frontier {
          0%, 100% { box-shadow: 0 0 16px rgba(239,68,68,0.9), 0 0 32px rgba(239,68,68,0.5); transform: scale(1); }
          50% { box-shadow: 0 0 28px rgba(239,68,68,1), 0 0 56px rgba(239,68,68,0.7); transform: scale(1.2); }
        }
        .alert-active { animation: pulse-red 1.5s ease-in-out infinite; }
        .leaflet-container { background: #f8fafc !important; }
      `}</style>

      {/* ─── LEFT SIDEBAR: Live Tracking Panel ──────────────────────────────── */}
      <div className="w-80 flex flex-col bg-white border-r border-slate-200 text-slate-800 overflow-hidden flex-shrink-0 z-20">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 bg-white">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            {(alertsData?.length ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center animate-bounce shadow-xs">
                {alertsData?.length}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight font-heading flex items-center gap-1.5">
              Relay Chase Network
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </h2>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider font-mono">
              Live Suspect Tracking
            </p>
          </div>
        </div>

        {/* Active Alerts List */}
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono">Active Targets</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-mono font-bold">
              {alertsData?.length ?? 0} LIVE
            </span>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {(alertsData?.length ?? 0) === 0 ? (
              <div className="text-center py-3 text-slate-400 text-xs font-mono">No active targets detected</div>
            ) : (
              alertsData?.map((a) => {
                const isSelected = selectedAlert?.alertId === a.alertId;
                return (
                  <button
                    key={a.alertId}
                    onClick={() => setSelectedAlert(a)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-xs ring-1 ring-blue-300'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold truncate text-slate-900">{a.suspectLabel}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold shrink-0 ml-2">
                        {a.relayChain.length} hops
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500 font-mono">
                      <span className="truncate">{a.alertId}</span>
                      <span className="text-rose-600 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        ACTIVE
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Alert Details */}
        {selectedAlert ? (
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border font-mono ${
                  selectedAlert.status === 'ACTIVE'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : selectedAlert.status === 'RESOLVED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {selectedAlert.status === 'ACTIVE' && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5 animate-pulse" />
                )}
                {selectedAlert.status}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{selectedAlert.alertId}</span>
            </div>

            {/* Suspect Info Dossier */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-13 h-13 rounded-lg bg-white flex items-center justify-center overflow-hidden border border-slate-200 flex-shrink-0 relative shadow-2xs">
                  {selectedAlert.snapshotObjectKey ? (
                    <img
                      src={`${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'}/snapshot/${selectedAlert.snapshotObjectKey}`}
                      alt="suspect"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <ShieldAlert className="w-6 h-6 text-slate-400" />
                  )}
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-rose-600 ring-2 ring-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate font-heading">{selectedAlert.suspectLabel}</p>
                  <p className="text-[10px] text-blue-600 font-semibold">
                    {selectedAlert.suspectType === 'KNOWN' ? 'Registered Case Target' : 'Unknown Recurring Subject'}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.round(selectedAlert.triggerSimilarity * 100))}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-700">
                      {(selectedAlert.triggerSimilarity * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-xl p-2.5 border border-slate-200 text-center shadow-2xs">
                <p className="text-lg font-black text-slate-900 font-mono">{selectedAlert.relayChain.length}</p>
                <p className="text-[9px] text-slate-400 uppercase font-bold font-mono">Hops</p>
              </div>
              <div className="bg-rose-50 rounded-xl p-2.5 border border-rose-100 text-center shadow-2xs">
                <p className="text-lg font-black text-rose-700 font-mono">{selectedAlert.frontierCameraIds?.length ?? 0}</p>
                <p className="text-[9px] text-rose-500 uppercase font-bold font-mono">Streaming</p>
              </div>
              <div className="bg-white rounded-xl p-2.5 border border-slate-200 text-center shadow-2xs">
                <p className="text-xs font-black text-slate-800 font-mono mt-1">{distanceCovered}</p>
                <p className="text-[9px] text-slate-400 uppercase font-bold font-mono">Distance</p>
              </div>
            </div>

            {/* Time Info */}
            <div className="flex items-center gap-2 text-xs text-slate-600 font-mono bg-slate-50 p-2 rounded-lg border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Active {elapsed}</span>
              <span className="ml-auto text-[10px] text-slate-400">
                Exp: {new Date(selectedAlert.expiresAt).toLocaleTimeString()}
              </span>
            </div>

            {/* Relay Chain Timeline */}
            <div>
              <p className="text-[10px] uppercase font-mono font-bold text-slate-400 mb-2 tracking-wider flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-slate-500" /> Sighting Trail
              </p>
              <div className="space-y-2">
                {selectedAlert.relayChain.map((hop, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    {/* Step indicator */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black font-mono flex-shrink-0 ${
                          i === 0
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {hop.hopIndex + 1}
                      </div>
                      {i < selectedAlert.relayChain.length - 1 && (
                        <div className="w-px h-4 bg-slate-200 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{hop.cameraName}</p>
                      <p className="text-[10px] text-slate-500 truncate">{hop.locationName}</p>
                      <p className="text-[10px] text-slate-600 font-mono font-semibold">
                        {(hop.similarity * 100).toFixed(1)}% • {new Date(hop.detectedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerted Cameras */}
            {selectedAlert.alertedCameraIds?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase font-mono font-bold text-slate-400 mb-2 tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3 text-rose-600" /> Frontier Cameras Watching
                </p>
                <div className="space-y-1">
                  {selectedAlert.alertedCameraIds.slice(0, 5).map((cam: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-rose-50 border border-rose-100 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse flex-shrink-0" />
                      <span className="text-[11px] text-rose-700 font-semibold truncate font-mono">
                        {cam.name || `Camera ${i + 1}`}
                      </span>
                    </div>
                  ))}
                  {selectedAlert.alertedCameraIds.length > 5 && (
                    <p className="text-[10px] text-slate-400 text-center font-mono">+{selectedAlert.alertedCameraIds.length - 5} more</p>
                  )}
                </div>
              </div>
            )}

            {/* Resolve Button */}
            {user?.role === 'admin' && selectedAlert.status === 'ACTIVE' && (
              <button
                onClick={handleResolve}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Resolve Alert & End Tracking
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3 text-slate-400 shadow-2xs">
              <Radio className="w-7 h-7 text-slate-400 animate-pulse" />
            </div>
            <p className="text-sm font-bold text-slate-700">No Target Selected</p>
            <p className="text-xs text-slate-400 mt-1">
              Select an alert from the queue or wait for live CCTV face recognition triggers.
            </p>
          </div>
        )}
      </div>

      {/* ─── MAP AREA: Geospatial Viewport ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col relative">
        {/* Floating Top Legend Bar */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-4 bg-white/95 backdrop-blur-md border border-slate-200 rounded-full px-5 py-2 text-[10px] font-bold text-slate-700 shadow-md">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-400 inline-block" />
            <span className="text-slate-600">Camera</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-600 inline-block animate-pulse" />
            <span className="text-rose-700 font-extrabold">FRONTIER</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            <span className="text-slate-800">Confirmed</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-400 opacity-50 inline-block" />
            <span className="text-slate-500">Pruned</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-amber-500 inline-block" style={{ borderTop: '2px dashed #f59e0b' }} />
            <span className="text-slate-600">Trail</span>
          </span>
        </div>

        {/* Top Right Connected Nodes Badge */}
        <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl px-3.5 py-2 text-[10px] font-bold text-slate-700 flex items-center gap-2 shadow-md">
          <Camera className="w-3.5 h-3.5 text-slate-600" />
          <span>{cameras?.length ?? 0} cameras</span>
          {(alertsData?.length ?? 0) > 0 && (
            <>
              <span className="text-slate-300">|</span>
              <span className="text-rose-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {alertsData!.length} active alert{alertsData!.length > 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>

        {/* Leaflet Map Canvas */}
        <div ref={mapContainerRef} className="flex-1 w-full" style={{ minHeight: '400px' }} />

        {/* Live Activity Feed Overlay */}
        <div className="absolute bottom-3 left-3 z-[1000] w-80 max-h-38 overflow-hidden">
          {liveActivity.length > 0 && (
            <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-3.5 space-y-2 shadow-md">
              <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5 font-mono">
                <span className="w-2 h-2 rounded-full bg-slate-900 animate-ping" />
                Live Feed
              </p>
              <div className="space-y-1.5 overflow-y-auto max-h-24">
                {liveActivity.slice(0, 4).map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[9px] text-slate-400 shrink-0 mt-0.5 font-mono">
                      {a.time.toLocaleTimeString()}
                    </span>
                    <span className="text-[10px] text-slate-700 leading-tight font-semibold">{a.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── RIGHT: Alert List Slim Panel ─────────────────────────────────── */}
      <div className="w-68 bg-white border-l border-slate-200 text-slate-800 flex flex-col overflow-hidden flex-shrink-0 z-20">
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider font-mono">All Alerts</p>
          <span className="text-[9px] font-mono text-slate-500 font-bold">{alertsData?.length ?? 0} Recorded</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {(alertsData?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <XCircle className="w-6 h-6 text-slate-300 mb-2" />
              <p className="text-xs text-slate-400 font-mono">No alerts yet</p>
            </div>
          ) : (
            alertsData?.map((a) => {
              const isSelected = selectedAlert?.alertId === a.alertId;
              return (
                <button
                  key={a.alertId}
                  onClick={() => setSelectedAlert(a)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 border-l-2 border-l-blue-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      a.status === 'ACTIVE' ? 'bg-rose-500 animate-pulse' :
                      a.status === 'RESOLVED' ? 'bg-emerald-500' : 'bg-slate-400'
                    }`} />
                    <span className="text-xs font-bold text-slate-900 truncate">{a.suspectLabel}</span>
                  </div>
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-[9px] text-slate-400">{a.alertId}</span>
                    <span className="text-[9px] text-slate-700 font-bold">{a.relayChain.length} hops</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 font-mono">
                    <MapPin className="w-2.5 h-2.5 text-slate-400" />
                    <span className="text-[9px] text-slate-500 truncate">
                      {typeof a.originCameraId === 'object'
                        ? a.originCameraId?.name
                        : 'Origin Camera'}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Quick Stats Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2 flex-shrink-0 font-mono">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500 font-semibold">Active:</span>
            <span className="font-extrabold text-slate-900">{alertsData?.filter(a => a.status === 'ACTIVE').length ?? 0}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500 font-semibold">Cameras Alerted:</span>
            <span className="font-extrabold text-slate-700">
              {alertsData?.reduce((sum, a) => sum + (a.alertedCameraIds?.length ?? 0), 0) ?? 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuspectChaseMap;
