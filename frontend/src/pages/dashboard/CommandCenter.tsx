/**
 * CommandCenter.tsx
 * Advanced Intelligence Command Center — the premium analytics dashboard.
 *
 * Features:
 *  - Real-time stat cards with live Socket.IO updates
 *  - 24h hourly detection bar chart (Chart.js)
 *  - Camera network health donut chart
 *  - Live threat leaderboard with score bars
 *  - Active relay alerts feed
 *  - Zone breach live ticker
 *  - City detection heatmap link
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  ShieldAlert,
  Radio,
  Camera,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Zap,
  MapPin,
  Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import socket from '../../socket';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

// ─── Threat level colors ─────────────────────────────────────────────────────
const LEVEL_CONFIG = {
  CRITICAL: { color: '#ef4444', bg: 'bg-red-600', text: 'text-red-400', border: 'border-red-800', glow: 'shadow-red-500/40' },
  HIGH:     { color: '#f97316', bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-800', glow: 'shadow-orange-500/40' },
  MEDIUM:   { color: '#f59e0b', bg: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-800', glow: 'shadow-amber-500/40' },
  LOW:      { color: '#10b981', bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-800', glow: 'shadow-emerald-500/40' },
};

// ─── Animated counter hook ───────────────────────────────────────────────────
function useAnimatedCount(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const from = count;
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setCount(Math.round(from + (target - from) * eased));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return count;
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
const LiveStatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
  accent: string;
  pulse?: boolean;
}> = ({ icon: Icon, label, value, sub, accent, pulse }) => {
  const animated = useAnimatedCount(value);
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}>
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
        {pulse && (
          <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ color: accent }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />
            LIVE
          </span>
        )}
      </div>
      <div>
        <p className="text-3xl font-black text-white">{animated.toLocaleString()}</p>
        <p className="text-xs font-semibold text-slate-400 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-slate-600 mt-1">{sub}</p>}
      </div>
      {/* Subtle glow stripe */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
    </div>
  );
};

// ─── Threat Score Bar ─────────────────────────────────────────────────────────
const ThreatBar: React.FC<{ score: number; level: string }> = ({ score, level }) => {
  const cfg = LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG.LOW;
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${score}%`, backgroundColor: cfg.color }}
        />
      </div>
      <span className="text-[10px] font-black w-7 text-right" style={{ color: cfg.color }}>{score}</span>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const CommandCenter: React.FC = () => {
  const navigate = useNavigate();
  const [liveDetections, setLiveDetections] = useState(0);
  const [zoneBreach, setZoneBreach] = useState<any>(null);
  const [breachTicker, setBreachTicker] = useState<any[]>([]);

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const { data: summary } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: async () => (await api.get('/analytics/summary')).data.data,
    refetchInterval: 30000,
  });

  const { data: hourlyData } = useQuery({
    queryKey: ['analytics-hourly'],
    queryFn: async () => (await api.get('/analytics/hourly-detections')).data.data as any[],
    refetchInterval: 60000,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['analytics-leaderboard'],
    queryFn: async () => (await api.get('/analytics/threat-leaderboard?limit=8')).data.data as any[],
    refetchInterval: 30000,
  });

  const { data: activeAlerts } = useQuery({
    queryKey: ['suspect-alerts-active'],
    queryFn: async () => (await api.get('/suspect-alerts?status=ACTIVE&limit=5')).data.data as any[],
    refetchInterval: 15000,
  });

  // ── Animated live detections counter ──────────────────────────────────────
  useEffect(() => {
    if (summary) setLiveDetections(summary.sightings24h || 0);
  }, [summary]);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    const onSighting = () => setLiveDetections((n) => n + 1);
    const onZoneBreach = (data: any) => {
      setZoneBreach(data);
      setBreachTicker((prev) => [data, ...prev].slice(0, 5));
      setTimeout(() => setZoneBreach(null), 8000);
    };
    socket.on('sighting:new', onSighting);
    socket.on('zone:breach', onZoneBreach);
    return () => {
      socket.off('sighting:new', onSighting);
      socket.off('zone:breach', onZoneBreach);
    };
  }, []);

  // ── Chart data ─────────────────────────────────────────────────────────────
  const hourlyChartData = {
    labels: hourlyData?.map((h) => h.label) || [],
    datasets: [{
      label: 'Detections',
      data: hourlyData?.map((h) => h.count) || [],
      backgroundColor: hourlyData?.map((h, i) => {
        const now = new Date().getHours();
        return i === now ? '#f59e0b' : '#334155';
      }) || [],
      borderRadius: 4,
      borderWidth: 0,
    }],
  };

  const cameraDonutData = {
    labels: ['Online', 'Offline', 'Maintenance'],
    datasets: [{
      data: [
        summary?.cameraHealth?.online || 0,
        (summary?.cameraHealth?.total || 0) - (summary?.cameraHealth?.online || 0),
        0,
      ],
      backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
      borderWidth: 0,
      hoverBorderWidth: 2,
      hoverBorderColor: '#1e293b',
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8' } },
    scales: {
      x: { grid: { color: '#1e293b' }, ticks: { color: '#64748b', font: { size: 9 } } },
      y: { grid: { color: '#1e293b' }, ticks: { color: '#64748b', font: { size: 9 } } },
    },
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b' } },
    cutout: '72%',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 space-y-6">
      {/* ── Zone Breach Banner ─────────────────────────────────────────────── */}
      {zoneBreach && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-right">
          <div className={`rounded-2xl p-4 border flex items-start gap-3 shadow-2xl ${
            zoneBreach.zoneType === 'HIGH_SECURITY'
              ? 'bg-red-950 border-red-800 shadow-red-900'
              : 'bg-amber-950 border-amber-800 shadow-amber-900'
          }`}>
            <AlertTriangle className={`w-6 h-6 flex-shrink-0 mt-0.5 ${zoneBreach.zoneType === 'HIGH_SECURITY' ? 'text-red-400' : 'text-amber-400'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">🚨 Zone Breach Detected</p>
              <p className="text-xs text-slate-300 mt-0.5">
                <strong>{zoneBreach.suspectLabel}</strong> entered <strong>{zoneBreach.zoneName}</strong>
              </p>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">
                {new Date(zoneBreach.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <button onClick={() => setZoneBreach(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Intelligence Command Center</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Real-time city surveillance intelligence • MPDS</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-900/30 border border-emerald-800/40 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">System Active</span>
          </div>
          <div className="text-xs text-slate-500 font-mono">{new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* ── Top Stat Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <LiveStatCard icon={Eye} label="Detections Today" value={liveDetections} sub="Live updates via socket" accent="#f59e0b" pulse />
        <LiveStatCard icon={Radio} label="Active Alerts" value={activeAlerts?.length || 0} sub="Relay chases in progress" accent="#ef4444" pulse={(activeAlerts?.length || 0) > 0} />
        <LiveStatCard icon={Camera} label="Cameras Online" value={summary?.cameraHealth?.online || 0} sub={`of ${summary?.cameraHealth?.total || 0} total`} accent="#10b981" />
        <LiveStatCard icon={ShieldAlert} label="Threats Detected" value={(summary?.threatCounts?.critical || 0) + (summary?.threatCounts?.high || 0)} sub={`${summary?.threatCounts?.critical || 0} critical`} accent="#a855f7" />
      </div>

      {/* ── Charts Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 24h Detection Bar Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-white">24-Hour Detection Timeline</p>
              <p className="text-[10px] text-slate-500">Detections per hour across all cameras</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Current Hour
            </div>
          </div>
          <div style={{ height: '200px' }}>
            {hourlyData ? (
              <Bar data={hourlyChartData} options={chartOptions as any} />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 text-xs">Loading chart...</div>
            )}
          </div>
        </div>

        {/* Camera Health Donut */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <p className="text-sm font-bold text-white mb-1">Camera Network</p>
          <p className="text-[10px] text-slate-500 mb-4">Live status distribution</p>
          <div className="flex-1 flex items-center justify-center relative" style={{ minHeight: '160px' }}>
            <Doughnut data={cameraDonutData} options={donutOptions as any} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-2xl font-black text-white">{summary?.cameraHealth?.healthPct || 0}%</p>
              <p className="text-[10px] text-slate-500">Health</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[
              { label: 'Online', value: summary?.cameraHealth?.online || 0, color: '#10b981' },
              { label: 'Offline', value: (summary?.cameraHealth?.total || 0) - (summary?.cameraHealth?.online || 0), color: '#ef4444' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-lg font-black" style={{ color: item.color }}>{item.value}</p>
                <p className="text-[9px] text-slate-500 uppercase font-bold">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Threat Leaderboard */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-red-500" />
                AI Threat Leaderboard
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Ranked by dynamic threat score</p>
            </div>
            <button
              onClick={() => navigate('/analytics/threats')}
              className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
            >
              View All →
            </button>
          </div>
          <div className="divide-y divide-slate-800/60">
            {!leaderboard || leaderboard.length === 0 ? (
              <div className="p-6 text-center text-slate-600 text-xs">No threat data yet. Detections will appear here.</div>
            ) : (
              leaderboard.slice(0, 6).map((suspect, i) => {
                const cfg = LEVEL_CONFIG[suspect.level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG.LOW;
                return (
                  <div key={suspect.suspectId} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-800/30 transition-colors">
                    <span className="text-sm font-black text-slate-600 w-5 text-center">{i + 1}</span>
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-700">
                      {suspect.snapshotUrl ? (
                        <img src={suspect.snapshotUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-white truncate">{suspect.suspectLabel}</p>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${cfg.text} border ${cfg.border}`} style={{ background: `${cfg.color}15` }}>
                          {suspect.level}
                        </span>
                        {suspect.activeAlertId && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" title="Active Chase" />
                        )}
                      </div>
                      <ThreatBar score={suspect.score} level={suspect.level} />
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-slate-500 font-medium">
                        {suspect.suspectType === 'KNOWN' ? '👤 Known' : '❓ Unknown'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Alerts + Zone Breaches */}
        <div className="space-y-4">
          {/* Active Relay Alerts */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-red-500" />
                Active Chases
              </p>
              <button
                onClick={() => navigate('/suspects/chase-map')}
                className="text-[10px] text-slate-400 hover:text-white font-bold uppercase tracking-wider"
              >
                Map →
              </button>
            </div>
            <div className="divide-y divide-slate-800/40 max-h-44 overflow-y-auto">
              {!activeAlerts || activeAlerts.length === 0 ? (
                <div className="p-4 text-center text-slate-600 text-xs">No active chases</div>
              ) : (
                activeAlerts.map((alert: any) => (
                  <div key={alert.alertId} className="px-4 py-2.5 hover:bg-slate-800/30">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                      <p className="text-xs font-semibold text-white truncate flex-1">{alert.suspectLabel}</p>
                      <span className="text-[9px] text-amber-400 font-bold">{alert.relayChain?.length || 0} hops</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-0.5 font-mono">{alert.alertId}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Zone Breach History */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-500" />
                Zone Breaches
              </p>
              <button
                onClick={() => navigate('/zones')}
                className="text-[10px] text-slate-400 hover:text-white font-bold uppercase tracking-wider"
              >
                Manage →
              </button>
            </div>
            <div className="divide-y divide-slate-800/40 max-h-44 overflow-y-auto">
              {breachTicker.length === 0 ? (
                <div className="p-4 text-center text-slate-600 text-xs">No breaches detected</div>
              ) : (
                breachTicker.map((b, i) => (
                  <div key={i} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`w-3 h-3 flex-shrink-0 ${b.zoneType === 'HIGH_SECURITY' ? 'text-red-400' : 'text-amber-400'}`} />
                      <p className="text-xs font-semibold text-white truncate">{b.zoneName}</p>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-0.5 truncate">{b.suspectLabel}</p>
                    <p className="text-[9px] text-slate-600 font-mono">{new Date(b.timestamp).toLocaleTimeString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Actions</p>
            {[
              { label: 'Chase Map', icon: Radio, path: '/suspects/chase-map', accent: '#ef4444' },
              { label: 'Relay Alerts', icon: ShieldAlert, path: '/suspects/alerts', accent: '#f97316' },
              { label: 'Threat Board', icon: Zap, path: '/analytics/threats', accent: '#a855f7' },
              { label: 'Zone Manager', icon: MapPin, path: '/zones', accent: '#3b82f6' },
            ].map((action) => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-colors text-left"
              >
                <action.icon className="w-4 h-4 flex-shrink-0" style={{ color: action.accent }} />
                <span className="text-xs font-semibold text-slate-300">{action.label}</span>
                <span className="ml-auto text-slate-600 text-xs">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandCenter;
