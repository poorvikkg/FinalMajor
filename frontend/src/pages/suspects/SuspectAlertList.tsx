/**
 * SuspectAlertList.tsx
 * Management table for all suspect relay alerts across the city network.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Radio,
  ShieldAlert,
  CheckCircle2,
  Clock,
  ChevronRight,
  Filter,
  Activity,
  MapPin,
  XCircle,
} from 'lucide-react';
import api from '../../api';
import { useAuthStore } from '../../store/auth';

interface RelayHop {
  cameraId: string;
  cameraName: string;
  locationName: string;
  detectedAt: string;
  similarity: number;
  hopIndex: number;
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
  resolvedAt?: string;
  resolvedReason?: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-red-900/40 text-red-400 border-red-800',
  RESOLVED: 'bg-emerald-900/40 text-emerald-400 border-emerald-800',
  EXPIRED: 'bg-slate-800 text-slate-500 border-slate-700',
};

export const SuspectAlertList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['suspect-alerts-list', statusFilter],
    queryFn: async () => {
      const params = statusFilter ? `?status=${statusFilter}&limit=100` : '?limit=100';
      const res = await api.get(`/suspect-alerts${params}`);
      return res.data.data as SuspectAlert[];
    },
    refetchInterval: 15000,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ alertId, reason }: { alertId: string; reason: string }) => {
      await api.post(`/suspect-alerts/${alertId}/resolve`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suspect-alerts-list'] });
    },
  });

  const activeCount = data?.filter((a) => a.status === 'ACTIVE').length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-800/30 flex items-center justify-center">
            <Radio className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Suspect Relay Alerts</h1>
            <p className="text-xs text-slate-500 font-medium">
              City-wide CCTV relay chase network • {activeCount} active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter */}
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-2" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold bg-transparent border-none outline-none text-slate-700 pr-2 py-1"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="RESOLVED">Resolved</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          {/* Go to live map */}
          <button
            onClick={() => navigate('/suspects/chase-map')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 transition-colors"
          >
            <Activity className="w-4 h-4" />
            Live Chase Map
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Alerts', value: data?.length ?? 0, color: 'text-slate-800' },
          { label: 'Active', value: activeCount, color: 'text-red-600', pulse: activeCount > 0 },
          { label: 'Resolved', value: data?.filter((a) => a.status === 'RESOLVED').length ?? 0, color: 'text-emerald-600' },
          {
            label: 'Cameras Alerted',
            value: data?.reduce((sum, a) => sum + (a.status === 'ACTIVE' ? (a.alertedCameraIds?.length ?? 0) : 0), 0) ?? 0,
            color: 'text-amber-600',
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">{stat.label}</p>
            <p className={`text-3xl font-black ${stat.color} flex items-center gap-2`}>
              {stat.value}
              {stat.pulse && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Alerts Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-4">Alert</th>
              <th className="px-6 py-4">Suspect</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Origin Camera</th>
              <th className="px-6 py-4">Relay Hops</th>
              <th className="px-6 py-4">Alerted</th>
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-xs text-slate-400">
                  Loading alerts...
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <XCircle className="w-10 h-10 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-400">No alerts found</p>
                    <p className="text-xs text-slate-400">
                      Alerts appear automatically when suspects are detected on live cameras.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((alert) => (
                <React.Fragment key={alert.alertId}>
                  <tr
                    className={`hover:bg-slate-50/70 transition-colors ${
                      expandedId === alert.alertId ? 'bg-slate-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          alert.status === 'ACTIVE' ? 'bg-red-500 animate-pulse' :
                          alert.status === 'RESOLVED' ? 'bg-emerald-500' : 'bg-slate-400'
                        }`} />
                        <span className="font-mono text-xs font-semibold text-slate-700">{alert.alertId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <ShieldAlert className="w-4 h-4 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{alert.suspectLabel}</p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {alert.suspectType === 'KNOWN' ? 'Known Person' : 'Unknown Recurring'}
                            {' • '}{(alert.triggerSimilarity * 100).toFixed(1)}% confidence
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${STATUS_COLORS[alert.status]}`}>
                        {alert.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-slate-700">
                            {typeof alert.originCameraId === 'object'
                              ? alert.originCameraId?.name
                              : 'Unknown Camera'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {typeof alert.originCameraId === 'object'
                              ? alert.originCameraId?.location?.name
                              : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className="flex">
                          {[...Array(Math.min(alert.relayChain.length, 5))].map((_, i) => (
                            <div
                              key={i}
                              className={`w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white -ml-1 first:ml-0 ${
                                i === 0 ? 'bg-red-500 text-white' : 'bg-amber-400 text-slate-900'
                              }`}
                            >
                              {i + 1}
                            </div>
                          ))}
                          {alert.relayChain.length > 5 && (
                            <div className="w-5 h-5 rounded-full bg-slate-200 text-[8px] font-bold flex items-center justify-center border-2 border-white -ml-1 text-slate-600">
                              +{alert.relayChain.length - 5}
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-slate-600 ml-1">
                          {alert.relayChain.length} hops
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-red-600">{alert.alertedCameraIds?.length ?? 0}</span>
                      <span className="text-xs text-slate-400 ml-1">cameras</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* View relay chain */}
                        <button
                          onClick={() =>
                            setExpandedId(expandedId === alert.alertId ? null : alert.alertId)
                          }
                          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
                          title="View relay chain"
                        >
                          <ChevronRight
                            className={`w-4 h-4 transition-transform ${
                              expandedId === alert.alertId ? 'rotate-90' : ''
                            }`}
                          />
                        </button>

                        {/* Live map */}
                        <button
                          onClick={() => navigate('/suspects/chase-map')}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"
                          title="View on map"
                        >
                          <Activity className="w-4 h-4" />
                        </button>

                        {/* Resolve */}
                        {user?.role === 'admin' && alert.status === 'ACTIVE' && (
                          <button
                            onClick={() =>
                              resolveMutation.mutate({
                                alertId: alert.alertId,
                                reason: 'Resolved by operator',
                              })
                            }
                            disabled={resolveMutation.isPending}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                            title="Resolve alert"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded relay chain row */}
                  {expandedId === alert.alertId && (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                        <p className="text-[10px] uppercase font-bold text-slate-500 mb-3 tracking-wider">
                          Relay Chain — {alert.relayChain.length} detection hops
                        </p>
                        <div className="flex items-center gap-0">
                          {alert.relayChain.map((hop, i) => (
                            <React.Fragment key={i}>
                              <div className="flex flex-col items-center text-center min-w-[120px]">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black mb-1 ${
                                    i === 0
                                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                                      : 'bg-amber-400 text-slate-900 shadow-lg shadow-amber-400/30'
                                  }`}
                                >
                                  {hop.hopIndex + 1}
                                </div>
                                <p className="text-[10px] font-bold text-slate-700 leading-tight max-w-[100px]">
                                  {hop.cameraName}
                                </p>
                                <p className="text-[9px] text-slate-400 max-w-[100px] leading-tight">
                                  {hop.locationName}
                                </p>
                                <p className="text-[9px] text-amber-600 font-semibold">
                                  {(hop.similarity * 100).toFixed(0)}%
                                </p>
                                <p className="text-[9px] text-slate-400 font-mono">
                                  {new Date(hop.detectedAt).toLocaleTimeString()}
                                </p>
                              </div>
                              {i < alert.relayChain.length - 1 && (
                                <div className="flex-1 h-0.5 bg-gradient-to-r from-amber-400 to-amber-200 mx-1 min-w-[20px]" />
                              )}
                            </React.Fragment>
                          ))}

                          {alert.alertedCameraIds?.length > 0 && (
                            <>
                              <div className="flex-1 h-0.5 bg-red-300/50 mx-1 min-w-[20px] border-t border-dashed border-red-400" />
                              <div className="flex flex-col items-center text-center min-w-[120px]">
                                <div className="w-8 h-8 rounded-full bg-red-600/20 border-2 border-red-500 border-dashed flex items-center justify-center mb-1 animate-pulse">
                                  <span className="text-[9px] text-red-500 font-bold">👁</span>
                                </div>
                                <p className="text-[10px] font-bold text-red-500">On Watch</p>
                                <p className="text-[9px] text-slate-400">
                                  {alert.alertedCameraIds.length} cameras alerted
                                </p>
                              </div>
                            </>
                          )}
                        </div>

                        {alert.resolvedReason && (
                          <p className="mt-3 text-[10px] text-slate-500">
                            <span className="font-semibold">Resolution:</span> {alert.resolvedReason}
                            {alert.resolvedAt && ` — ${new Date(alert.resolvedAt).toLocaleString()}`}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SuspectAlertList;
