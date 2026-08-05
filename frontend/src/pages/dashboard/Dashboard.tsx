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
  const { data, isLoading } = useQuery<DashboardData & { latestSightings: any[] }>({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      try {
        const [statsRes, alertsRes, complaintsRes, sightingsRes] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/alerts'),
          api.get('/complaints?limit=5'),
          api.get('/sightings?limit=5'),
        ]);
        return {
          stats: statsRes.data.data,
          alerts: alertsRes.data.data,
          complaints: complaintsRes.data.data,
          latestSightings: sightingsRes.data.data || [],
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
          latestSightings: [],
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
          title="Review Required"
          value={isLoading ? '—' : (stats as any)?.unknownPersons?.reviewRequired ?? 0}
          description={`${(stats as any)?.unknownPersons?.recurring ?? 0} recurring identities`}
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

        {/* Latest Geo-Located Sightings */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Latest Geo-Located Sightings
            </CardTitle>
            <a
              href="/detection-map"
              className="text-[11px] font-bold text-slate-900 hover:underline uppercase tracking-wider"
            >
              View Detection Map &rarr;
            </a>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 text-xs">
              {data?.latestSightings && data.latestSightings.length > 0 ? (
                data.latestSightings.map((sighting: any) => (
                  <div key={sighting._id} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono">
                          {sighting.identityType === 'KNOWN'
                            ? sighting.personId?.missingPersonName || 'Registered Subject'
                            : sighting.unknownPersonId?.unknownId || 'Unknown Subject'}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded text-white ${
                            sighting.identityType === 'KNOWN' ? 'bg-emerald-600' : 'bg-slate-900'
                          }`}
                        >
                          {sighting.identityType}
                        </span>
                      </div>
                      <p className="text-slate-500 font-medium">{sighting.location?.name}</p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="font-mono text-[11px] text-slate-500">
                        {new Date(sighting.detectedAt).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold">
                        Match: {Math.round(sighting.similarity * 100)}%
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs uppercase tracking-wider">
                  No location sightings recorded yet.
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
