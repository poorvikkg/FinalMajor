import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from '../../components/shared/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
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

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900 tracking-widest uppercase font-heading">Dashboard</h1>

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
        />
        <StatCard
          title="Unknown Detections"
          value={isLoading ? '—' : stats?.recognitions?.unknownDetections ?? 0}
        />
        <StatCard
          title="Videos Processed"
          value={isLoading ? '—' : stats?.videos?.processed ?? 0}
          description="Completed recordings"
        />
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
