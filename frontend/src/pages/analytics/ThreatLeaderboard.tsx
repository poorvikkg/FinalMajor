/**
 * ThreatLeaderboard.tsx
 * Full-page AI threat intelligence leaderboard.
 * Shows all tracked suspects ranked by dynamic threat score.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Zap,
  ShieldAlert,
  Activity,
  Clock,
  ChevronRight,
  Filter,
  TrendingUp,
} from 'lucide-react';
import api from '../../api';

const LEVEL_CONFIG = {
  CRITICAL: { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
  HIGH:     { label: 'High',     color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' },
  MEDIUM:   { label: 'Medium',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  LOW:      { label: 'Low',      color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
};

export const ThreatLeaderboard: React.FC = () => {
  const navigate = useNavigate();
  const [levelFilter, setLevelFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['threat-leaderboard-full'],
    queryFn: async () => (await api.get('/analytics/threat-leaderboard?limit=50')).data.data as any[],
    refetchInterval: 30000,
  });

  const { data: summary } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: async () => (await api.get('/analytics/summary')).data.data,
    refetchInterval: 30000,
  });

  const filtered = data
    ? levelFilter
      ? data.filter((s) => s.level === levelFilter)
      : data
    : [];

  const levelCounts = {
    CRITICAL: data?.filter(s => s.level === 'CRITICAL').length || 0,
    HIGH: data?.filter(s => s.level === 'HIGH').length || 0,
    MEDIUM: data?.filter(s => s.level === 'MEDIUM').length || 0,
    LOW: data?.filter(s => s.level === 'LOW').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-800/30 flex items-center justify-center">
            <Zap className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">AI Threat Leaderboard</h1>
            <p className="text-xs text-slate-500 font-medium">
              Dynamic threat scoring • {data?.length || 0} suspects tracked
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-2" />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="text-xs font-semibold bg-transparent border-none outline-none text-slate-700 pr-2 py-1"
            >
              <option value="">All Levels</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Level Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(LEVEL_CONFIG).map(([level, cfg]) => (
          <button
            key={level}
            onClick={() => setLevelFilter(levelFilter === level ? '' : level)}
            className={`rounded-2xl p-4 text-left border-2 transition-all ${
              levelFilter === level ? 'scale-105 shadow-lg' : 'hover:scale-102'
            }`}
            style={{
              background: cfg.bg,
              borderColor: levelFilter === level ? cfg.color : 'transparent',
            }}
          >
            <p className="text-2xl font-black" style={{ color: cfg.color }}>
              {levelCounts[level as keyof typeof levelCounts]}
            </p>
            <p className="text-xs font-bold text-slate-600 mt-0.5">{cfg.label} Risk</p>
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-4 w-10">#</th>
              <th className="px-4 py-4">Suspect</th>
              <th className="px-4 py-4">Threat Level</th>
              <th className="px-4 py-4">Score Breakdown</th>
              <th className="px-4 py-4">Last Seen</th>
              <th className="px-4 py-4">Status</th>
              <th className="px-4 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={7} className="p-8 text-center text-xs text-slate-400">Computing threat scores...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center">
                  <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-400">No suspects at this threat level</p>
                </td>
              </tr>
            ) : (
              filtered.map((suspect, i) => {
                const cfg = LEVEL_CONFIG[suspect.level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG.LOW;
                const totalFactor = suspect.factors ? Object.values(suspect.factors).reduce((a: any, b: any) => a + b, 0) : 0;
                return (
                  <tr key={suspect.suspectId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-4">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">
                        {i + 1}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden border border-slate-200">
                          {suspect.snapshotUrl ? (
                            <img src={suspect.snapshotUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <ShieldAlert className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{suspect.suspectLabel}</p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {suspect.suspectType === 'KNOWN' ? '👤 Known Missing Person' : '❓ Unknown Recurring'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold border"
                          style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
                        >
                          {suspect.level === 'CRITICAL' && '⚠ '}
                          {cfg.label}
                        </div>
                        {suspect.activeAlertId && (
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Active relay chase" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {suspect.factors && (
                        <div className="space-y-1 min-w-[160px]">
                          {[
                            { label: 'Appearances', val: suspect.factors.appearances },
                            { label: 'Camera Spread', val: suspect.factors.cameraSpread },
                            { label: 'Relay Hops', val: suspect.factors.relayHops },
                            { label: 'Recent Activity', val: suspect.factors.recentActivity },
                          ].map(({ label, val }) => (
                            val > 0 ? (
                              <div key={label} className="flex items-center gap-2">
                                <span className="text-[9px] text-slate-400 w-24 flex-shrink-0">{label}</span>
                                <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${Math.min((val / 30) * 100, 100)}%`, backgroundColor: cfg.color }}
                                  />
                                </div>
                                <span className="text-[9px] font-bold text-slate-500 w-4 text-right">{val}</span>
                              </div>
                            ) : null
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {suspect.lastSeen ? new Date(suspect.lastSeen).toLocaleDateString() : 'Unknown'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className="text-right">
                          <span className="text-2xl font-black" style={{ color: cfg.color }}>{suspect.score}</span>
                          <p className="text-[9px] text-slate-400">/ 100</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {suspect.activeAlertId && (
                          <button
                            onClick={() => navigate('/suspects/chase-map')}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                            title="View on chase map"
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/suspects/timeline/${suspect.suspectId}?type=${suspect.suspectType}`)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                          title="View movement timeline"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ThreatLeaderboard;
