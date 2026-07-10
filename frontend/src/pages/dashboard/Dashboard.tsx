import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from '../../components/shared/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import api from '../../api';

interface DashboardData {
  stats: {
    users: { total: number };
    cameras: { total: number; online: number; offline: number; maintenance: number };
    videos: { processed: number };
    recognitions: { today: number; unknownDetections: number };
  };
  alerts: Array<{
    _id: string;
    cameraId?: { name: string; location: string };
    timestamp: string;
    confidence: number;
    isUnknown: boolean;
  }>;
  complaints: Array<{
    _id: string;
    name: string;
    type: string;
    priority: string;
    status: string;
    createdAt: string;
  }>;
}

export const Dashboard: React.FC = () => {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      try {
        const [statsRes, alertsRes, complaintsRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/alerts'),
          api.get('/complaints?limit=5'),
        ]);
        return {
          stats: statsRes.data.data,
          alerts: alertsRes.data.data,
          complaints: complaintsRes.data.data,
        };
      } catch {
        return {
          stats: {
            users: { total: 0 },
            cameras: { total: 0, online: 0, offline: 0, maintenance: 0 },
            videos: { processed: 0 },
            recognitions: { today: 0, unknownDetections: 0 },
          },
          alerts: [],
          complaints: [],
        };
      }
    },
  });

  const activityData = data?.stats ? [
    { name: 'Detections', detections: data.stats.recognitions?.today ?? 0, unknown: data.stats.recognitions?.unknownDetections ?? 0 }
  ] : [];

  const cameraUsageData = data?.stats ? [
    { name: 'Online', count: data.stats.cameras?.online ?? 0 },
    { name: 'Offline', count: data.stats.cameras?.offline ?? 0 },
    { name: 'Maintenance', count: data.stats.cameras?.maintenance ?? 0 },
  ] : [];

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest">Security Command Dashboard</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">Real-time surveillance status and system overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Cameras"
          value={isLoading ? '—' : stats?.cameras?.total ?? 0}
          description={`${stats?.cameras?.online ?? 0} online, ${stats?.cameras?.offline ?? 0} offline`}
        />
        <StatCard
          title="Recognitions Today"
          value={isLoading ? '—' : stats?.recognitions?.today ?? 0}
          trend={{ value: '14.5%', isPositive: true }}
        />
        <StatCard
          title="Unknown Detections"
          value={isLoading ? '—' : stats?.recognitions?.unknownDetections ?? 0}
          trend={{ value: '4.8%', isPositive: false }}
        />
        <StatCard
          title="Videos Processed"
          value={isLoading ? '—' : stats?.videos?.processed ?? 0}
          description="Completed recordings"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Detections Today</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="colorDet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e293b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1e293b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="detections" stroke="#1e293b" fill="url(#colorDet)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Camera Status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cameraUsageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#475569" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Unidentified Face Alerts (Last 24h)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {data?.alerts && data.alerts.length > 0 ? (
                data.alerts.map((alert) => (
                  <div key={alert._id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{alert.cameraId?.name || 'Unknown Camera'}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {alert.cameraId?.location || 'Unknown location'} — Conf: {alert.confidence ? (alert.confidence * 100).toFixed(0) : '0'}%
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-5 py-6 text-center text-[11px] text-slate-400 uppercase tracking-wider">
                  No alerts recorded today.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Complaints</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {data?.complaints && data.complaints.length > 0 ? (
                data.complaints.map((ticket) => (
                  <div key={ticket._id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900">{(ticket as any).missingPersonName || 'Unknown Person'}</p>
                        <Badge variant="warning">
                          Report
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Missing Person Case</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-mono text-slate-400 block">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{ticket.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-6 text-center text-[11px] text-slate-400 uppercase tracking-wider">
                  No active reports.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default Dashboard;
