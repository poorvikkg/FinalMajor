import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/shared/DataTable';
import api from '../../api';

interface Sighting {
  sourceType: 'camera' | 'video';
  sourceId?: string;
  sourceName?: string;
  snapshot: string;
  confidence: number;
  timestamp: string;
}

interface Suspect {
  _id: string;
  suspectId: string;
  representativeSnapshot: string;
  distinctSources: number;
  threatLevel: 'watch' | 'suspicious' | 'high';
  notes?: string;
  isResolved: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  sightings: Sighting[];
}

const THREAT_COLORS = {
  watch: 'neutral',
  suspicious: 'warning',
  high: 'danger',
} as const;

export function Suspects() {
  const [page, setPage] = useState(1);
  const [selectedSuspect, setSelectedSuspect] = useState<Suspect | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['suspects', page],
    queryFn: async () => {
      const res = await api.get(`/suspects?page=${page}&limit=10`);
      return res.data;
    },
    refetchInterval: 10000,
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/suspects/${id}/resolve`, { notes: 'Resolved by operator' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suspects'] });
      setSelectedSuspect(null);
    },
  });

  const suspects = data?.data || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1 };

  const columns = [
    {
      header: 'Profile',
      accessor: (row: Suspect) => (
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/${row.representativeSnapshot.replace(/\\/g, '/')}`}
            alt="Suspect"
            className="w-12 h-12 rounded-lg object-cover border border-slate-200"
          />
          <div>
            <p className="font-bold text-slate-800">{row.suspectId}</p>
            <p className="text-xs text-slate-500">First seen {new Date(row.firstSeenAt).toLocaleDateString()}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Threat Level',
      accessor: (row: Suspect) => (
        <Badge variant={THREAT_COLORS[row.threatLevel]}>
          {row.threatLevel.toUpperCase()}
        </Badge>
      ),
    },
    {
      header: 'Locations Spotted',
      accessor: (row: Suspect) => (
        <div>
          <p className="font-bold text-slate-700">{row.distinctSources} distinct sources</p>
          <p className="text-xs text-slate-500">{row.sightings.length} total sightings</p>
        </div>
      ),
    },
    {
      header: 'Last Seen',
      accessor: (row: Suspect) => (
        <div className="text-slate-500 font-mono text-xs">
          {new Date(row.lastSeenAt).toLocaleString()}
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: (row: Suspect) => (
        <Button variant="outline" size="sm" onClick={() => setSelectedSuspect(row)}>
          View Timeline
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Suspect Clustering</h1>
        <p className="text-slate-500 mt-1">
          Unknown individuals who have been detected across multiple cameras or videos are automatically promoted to suspects.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Suspects</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={suspects}
            isLoading={isLoading}
            pagination={{
              page: pagination.page,
              totalPages: pagination.totalPages,
              onPageChange: setPage,
            }}
            emptyMessage="No suspects currently identified."
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={!!selectedSuspect}
        onClose={() => setSelectedSuspect(null)}
        title={`Suspect Details: ${selectedSuspect?.suspectId}`}
        size="lg"
      >
        {selectedSuspect && (
          <div className="space-y-6">
            <div className="flex gap-6 items-start">
              <img
                src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/${selectedSuspect.representativeSnapshot.replace(/\\/g, '/')}`}
                alt="Suspect Profile"
                className="w-32 h-32 rounded-xl object-cover border-4 border-slate-100 shadow-sm"
              />
              <div>
                <Badge variant={THREAT_COLORS[selectedSuspect.threatLevel]} className="mb-2">
                  {selectedSuspect.threatLevel.toUpperCase()} THREAT
                </Badge>
                <p className="text-sm text-slate-600 mt-2">
                  <strong>First Sighting:</strong> {new Date(selectedSuspect.firstSeenAt).toLocaleString()}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Last Sighting:</strong> {new Date(selectedSuspect.lastSeenAt).toLocaleString()}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Distinct Sources:</strong> {selectedSuspect.distinctSources}
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-slate-800 mb-3 border-b pb-2">Sighting Timeline</h3>
              <div className="max-h-[300px] overflow-y-auto pr-2 space-y-4">
                {selectedSuspect.sightings.map((sighting, idx) => (
                  <div key={idx} className="flex gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <img
                      src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/${sighting.snapshot.replace(/\\/g, '/')}`}
                      alt="Sighting crop"
                      className="w-16 h-16 rounded object-cover"
                    />
                    <div>
                      <p className="font-semibold text-slate-700">
                        {sighting.sourceType === 'camera' ? 'Live Camera' : 'Video Upload'}
                        {sighting.sourceName && ` - ${sighting.sourceName}`}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        {new Date(sighting.timestamp).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Confidence: {Math.round(sighting.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setSelectedSuspect(null)}>Close</Button>
              <Button 
                variant="default" 
                onClick={() => resolveMutation.mutate(selectedSuspect._id)}
                disabled={resolveMutation.isPending}
              >
                Resolve Case
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
