/**
 * CommandCenter.tsx
 * Advanced Intelligence Command Center — the premium analytics dashboard.
 * Optimized for a clean, professional, white/light theme.
 */

import React, { useEffect, useRef, useState } from 'react';
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
  AlertTriangle,
  Eye,
  Zap,
  MapPin,
  Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import socket from '../../socket';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

// ─── Threat level configuration (Slate/Monochrome Theme) ─────────────────────
const LEVEL_CONFIG = {
  CRITICAL: { color: '#0f172a', bg: 'bg-slate-900', text: 'text-slate-800', border: 'border-slate-300' },
  HIGH:     { color: '#334155', bg: 'bg-slate-700', text: 'text-slate-700', border: 'border-slate-200' },
  MEDIUM:   { color: '#475569', bg: 'bg-slate-600', text: 'text-slate-600', border: 'border-slate-200' },
  LOW:      { color: '#64748b', bg: 'bg-slate-500', text: 'text-slate-500', border: 'border-slate-100' },
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

// ─── Stat Card (Light Mode Style) ───────────────────────────────────────────
const LiveStatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
  pulse?: boolean;
}> = ({ icon: Icon, label, value, sub, pulse }) => {
  const animated = useAnimatedCount(value);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 border border-slate-100">
          <Icon className="w-5 h-5 text-slate-700" />
        </div>
        {pulse && (
          <span className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-900 animate-pulse" />
            LIVE
          </span>
        )}
      </div>
      <div>
        <p className="text-3xl font-black text-slate-950">{animated.toLocaleString()}</p>
        <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
};

// ─── Threat Score Bar ─────────────────────────────────────────────────────────
const ThreatBar: React.FC<{ score: number; level: string }> = ({ score, level }) => {
  const cfg = LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG.LOW;
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
      backgroundColor: '#475569', // Clean Slate gray
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
      backgroundColor: ['#0f172a', '#cbd5e1', '#e2e8f0'], // Grayscale Donut
      borderWidth: 0,
      hoverBorderWidth: 2,
      hoverBorderColor: '#ffffff',
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f172a', titleColor: '#ffffff', bodyColor: '#cbd5e1' } },
    scales: {
      x: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b', font: { size: 9 } } },
      y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b', font: { size: 9 } } },
    },
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f172a' } },
    cutout: '72%',
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* ── Zone Breach Banner ─────────────────────────────────────────────── */}
      {zoneBreach && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-right">
          <div className="rounded-2xl p-4 border flex items-start gap-3 shadow-2xl bg-white border-slate-200">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5 text-slate-700" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">🚨 Zone Breach Detected</p>
              <p className="text-xs text-slate-600 mt-0.5">
                <strong>{zoneBreach.suspectLabel}</strong> entered <strong>{zoneBreach.zoneName}</strong>
              </p>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                {new Date(zoneBreach.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <button onClick={() => setZoneBreach(null)} className="text-slate-400 hover:text-slate-900 text-xs">✕</button>
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight font-heading">Intelligence Command Center</h1>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">Real-time city surveillance intelligence • MPDS</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-900 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">System Active</span>
          </div>
          <div className="text-xs text-slate-400 font-mono">{new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* ── Top Stat Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <LiveStatCard icon={Eye} label="Detections Today" value={liveDetections} pulse />
        <LiveStatCard icon={Radio} label="Active Alerts" value={activeAlerts?.length || 0} pulse={(activeAlerts?.length || 0) > 0} />
        <LiveStatCard icon={Camera} label="Cameras Online" value={summary?.cameraHealth?.online || 0} sub={`of ${summary?.cameraHealth?.total || 0} total`} />
        <LiveStatCard icon={ShieldAlert} label="Threats Detected" value={(summary?.threatCounts?.critical || 0) + (summary?.threatCounts?.high || 0)} sub={`${summary?.threatCounts?.critical || 0} critical`} />
      </div>

      {/* ── Charts Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 24h Detection Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-slate-900">24-Hour Detection Timeline</p>
              <p className="text-[10px] text-slate-400">Detections per hour across all cameras</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-700 font-bold">
              <span className="w-2 h-2 rounded-full bg-slate-800" />
              Timeline Activity
            </div>
          </div>
          <div style={{ height: '200px' }}>
            {hourlyData ? (
              <Bar data={hourlyChartData} options={chartOptions as any} />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading chart...</div>
            )}
          </div>
        </div>

        {/* Camera Health Donut */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col shadow-sm">
          <p className="text-sm font-bold text-slate-900 mb-1">Camera Network</p>
          <p className="text-[10px] text-slate-500 mb-4">Live status distribution</p>
          <div className="flex-1 flex items-center justify-center relative" style={{ minHeight: '160px' }}>
            <Doughnut data={cameraDonutData} options={donutOptions as any} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-2xl font-black text-slate-900">{summary?.cameraHealth?.healthPct || 0}%</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Health</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[
              { label: 'Online', value: summary?.cameraHealth?.online || 0, color: '#0f172a' },
              { label: 'Offline', value: (summary?.cameraHealth?.total || 0) - (summary?.cameraHealth?.online || 0), color: '#94a3b8' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-lg font-black" style={{ color: item.color }}>{item.value}</p>
                <p className="text-[9px] text-slate-400 uppercase font-bold">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Threat Leaderboard */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-slate-800" />
                AI Threat Leaderboard
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Ranked by dynamic threat score</p>
            </div>
            <button
              onClick={() => navigate('/analytics/threats')}
              className="text-[10px] font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wider"
            >
              View All →
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {!leaderboard || leaderboard.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">No threat data yet. Detections will appear here.</div>
            ) : (
              leaderboard.slice(0, 6).map((suspect, i) => {
                const cfg = LEVEL_CONFIG[suspect.level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG.LOW;
                return (
                  <div key={suspect.suspectId} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                    <span className="text-sm font-black text-slate-400 w-5 text-center">{i + 1}</span>
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200">
                      {suspect.snapshotUrl ? (
                        <img src={suspect.snapshotUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900 truncate">{suspect.suspectLabel}</p>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${cfg.text} border ${cfg.border} bg-slate-50`}>
                          {suspect.level}
                        </span>
                        {suspect.activeAlertId && (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-800 animate-pulse flex-shrink-0" title="Active Chase" />
                        )}
                      </div>
                      <ThreatBar score={suspect.score} level={suspect.level} />
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-slate-400 font-semibold">
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
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Radio className="w-4 h-4 text-slate-800" />
                Active Chases
              </p>
              <button
                onClick={() => navigate('/suspects/chase-map')}
                className="text-[10px] text-slate-500 hover:text-slate-900 font-bold uppercase tracking-wider"
              >
                Map →
              </button>
            </div>
            <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto">
              {!activeAlerts || activeAlerts.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">No active chases</div>
              ) : (
                activeAlerts.map((alert: any) => (
                  <div key={alert.alertId} className="px-4 py-2.5 hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-800 animate-pulse flex-shrink-0" />
                      <p className="text-xs font-semibold text-slate-900 truncate flex-1">{alert.suspectLabel}</p>
                      <span className="text-[9px] text-slate-500 font-bold">{alert.relayChain?.length || 0} hops</span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5 font-mono">{alert.alertId}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Zone Breach History */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-800" />
                Zone Breaches
              </p>
              <button
                onClick={() => navigate('/zones')}
                className="text-[10px] text-slate-500 hover:text-slate-900 font-bold uppercase tracking-wider"
              >
                Manage →
              </button>
            </div>
            <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto">
              {breachTicker.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">No breaches detected</div>
              ) : (
                breachTicker.map((b, i) => (
                  <div key={i} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 text-slate-700" />
                      <p className="text-xs font-semibold text-slate-900 truncate">{b.zoneName}</p>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5 truncate">{b.suspectLabel}</p>
                    <p className="text-[9px] text-slate-500 font-mono">{new Date(b.timestamp).toLocaleTimeString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</p>
            {[
              { label: 'Chase Map', icon: Radio, path: '/suspects/chase-map' },
              { label: 'Relay Alerts', icon: ShieldAlert, path: '/suspects/alerts' },
              { label: 'Threat Board', icon: Zap, path: '/analytics/threats' },
              { label: 'Zone Manager', icon: MapPin, path: '/zones' },
            ].map((action) => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all text-left"
              >
                <action.icon className="w-4 h-4 flex-shrink-0 text-slate-700" />
                <span className="text-xs font-semibold text-slate-700">{action.label}</span>
                <span className="ml-auto text-slate-400 text-xs">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandCenter;
