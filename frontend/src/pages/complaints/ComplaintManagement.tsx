import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore } from '../../store/auth';
import api from '../../api';

interface ComplaintItem {
  _id: string;
  name: string;
  email: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  description: string;
  attachments?: string[];
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

const statusVariant = (s: string) =>
  s === 'resolved' || s === 'closed' ? 'success' : s === 'in_progress' ? 'warning' : 'neutral';

const priorityVariant = (p: string) =>
  p === 'critical' || p === 'high' ? 'danger' : 'warning';

const getImageUrl = (url: string) => {
  const normalized = url.replace(/\\/g, '/');
  return normalized.startsWith('http') ? normalized : `/${normalized}`;
};

/* ─────────────────────────────────────────────────── */
export const ComplaintManagement: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isViewer = user?.role === 'viewer';

  const [searchQuery, setSearchQuery] = useState('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selected, setSelected] = useState<ComplaintItem | null>(null);
  const [statusVal, setStatusVal] = useState<ComplaintItem['status']>('open');
  const [remarks, setRemarks] = useState('');

  // Fetch complaints — backend already filters by createdBy for viewer role
  const { data: tickets = [], isLoading } = useQuery<ComplaintItem[]>({
    queryKey: ['complaintsList'],
    queryFn: async () => {
      try {
        const r = await api.get('/complaints?limit=100');
        return r.data.data;
      } catch {
        return [];
      }
    },
    refetchInterval: isViewer ? 30000 : false, // viewers get auto-refresh to see status updates
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, remarks }: { id: string; status: string; remarks: string }) => {
      await api.put(`/complaints/${id}`, { status, remarks });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaintsList'] });
      setIsDetailOpen(false);
      setSelected(null);
    },
  });

  const openDetail = (t: ComplaintItem) => {
    setSelected(t);
    setStatusVal(t.status);
    setRemarks(t.remarks || '');
    setIsDetailOpen(true);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (selected) updateMutation.mutate({ id: selected._id, status: statusVal, remarks });
  };

  const filtered = tickets.filter(t => {
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    );
  });

  // Count status updates (resolved/closed) for viewer notification banner
  const updatedComplaints = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');

  /* ── VIEWER VIEW ─────────────────────────────────── */
  if (isViewer) {
    return (
      <div className="space-y-5 max-w-3xl">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest">My Complaints</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Track your submitted complaints and view status updates. Auto-refreshes every 30 seconds.
            </p>
          </div>
          <Button onClick={() => navigate('/file-case')}>File New Complaint</Button>
        </div>

        {/* Notification banner for resolved/closed complaints */}
        {updatedComplaints.length > 0 && (
          <div className="border border-slate-300 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
              Status Update — {updatedComplaints.length} complaint{updatedComplaints.length > 1 ? 's' : ''} resolved or closed.
              Click any row to view operator remarks.
            </p>
          </div>
        )}

        {tickets.length === 0 && !isLoading && (
          <div className="border border-slate-200 bg-slate-50 px-5 py-10 text-center">
            <p className="text-xs font-black text-slate-600 uppercase tracking-widest">No complaints filed yet.</p>
            <p className="text-[11px] text-slate-400 mt-1">Use "File New Complaint" to submit a report.</p>
          </div>
        )}

        {/* Complaint cards */}
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-[11px] text-slate-400 uppercase tracking-wider px-1">Loading...</p>
          ) : (
            filtered.map(t => (
              <div
                key={t._id}
                onClick={() => openDetail(t)}
                className="border border-slate-200 bg-white px-5 py-4 cursor-pointer hover:border-slate-400 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        {t.type.replace(/_/g, ' ')}
                      </p>
                      <Badge variant={priorityVariant(t.priority)}>{t.priority.toUpperCase()}</Badge>
                      <Badge variant={statusVariant(t.status)}>{t.status.replace(/_/g, ' ').toUpperCase()}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{t.description}</p>
                    {t.remarks && (
                      <div className="border-l-2 border-slate-400 pl-2 mt-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Operator Remark:</p>
                        <p className="text-[11px] text-slate-700">{t.remarks}</p>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-[10px] font-mono text-slate-400">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-[10px] font-mono text-slate-300">
                      Updated: {new Date(t.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail modal for viewer — read only */}
        {selected && (
          <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="Complaint Details">
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Category</p>
                  <p className="font-bold text-slate-900 mt-0.5">{selected.type.replace(/_/g, ' ').toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Priority</p>
                  <Badge variant={priorityVariant(selected.priority)}>{selected.priority.toUpperCase()}</Badge>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Status</p>
                  <Badge variant={statusVariant(selected.status)}>{selected.status.replace(/_/g, ' ').toUpperCase()}</Badge>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Filed On</p>
                  <p className="font-mono text-slate-600 mt-0.5">{new Date(selected.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Description</p>
                <p className="bg-slate-50 border border-slate-200 px-3 py-2 text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {selected.description}
                </p>
              </div>

              {selected.attachments && selected.attachments.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Suspect Photos / Evidence</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.attachments.map((url, i) => (
                      <a
                        key={i}
                        href={getImageUrl(url)}
                        target="_blank"
                        rel="noreferrer"
                        className="border border-slate-200 p-0.5 bg-white hover:border-slate-500 transition-colors"
                      >
                        <img
                          src={getImageUrl(url)}
                          alt={`Evidence ${i + 1}`}
                          className="h-20 w-20 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 pt-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Operator Remarks</p>
                {selected.remarks ? (
                  <p className="bg-slate-50 border border-slate-200 px-3 py-2 text-slate-800 leading-relaxed">
                    {selected.remarks}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">No remarks added yet. Your complaint is under review.</p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  /* ── ADMIN / OPERATOR VIEW ─────────────────────────── */
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest">Complaints & Tickets</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Manage and respond to all submitted security complaints.</p>
        </div>
        <Button onClick={() => navigate('/file-case')}>New Complaint</Button>
      </div>

      <Input
        placeholder="Search by name, type, description..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="px-5 py-3">Complainant</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Filed</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-[11px] text-slate-400 uppercase tracking-wider">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map(t => (
                    <tr key={t._id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <p className="font-bold text-slate-900">{t.name}</p>
                        <p className="text-[10px] text-slate-400">{t.email}</p>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-700">
                        {t.type.replace(/_/g, ' ').toUpperCase()}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={priorityVariant(t.priority)}>{t.priority.toUpperCase()}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={statusVariant(t.status)}>{t.status.replace(/_/g, ' ').toUpperCase()}</Badge>
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-400">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => openDetail(t)}>View</Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-[11px] text-slate-400 uppercase tracking-wider">
                      No complaints found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail + Update Modal for admin/operator */}
      {selected && (
        <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="Complaint Details">
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Complainant</p>
                <p className="font-bold text-slate-900 mt-0.5">{selected.name}</p>
                <p className="text-[10px] text-slate-400">{selected.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Filed</p>
                <p className="font-mono text-slate-600 mt-0.5">{new Date(selected.createdAt).toLocaleString()}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Description</p>
              <p className="bg-slate-50 border border-slate-200 px-3 py-2 text-slate-800 leading-relaxed whitespace-pre-wrap">
                {selected.description}
              </p>
            </div>

            {selected.attachments && selected.attachments.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Suspect Photos / Evidence</p>
                <div className="flex flex-wrap gap-2">
                  {selected.attachments.map((url, i) => (
                    <a
                      key={i}
                      href={getImageUrl(url)}
                      target="_blank"
                      rel="noreferrer"
                      className="border border-slate-200 p-0.5 bg-white hover:border-slate-500 transition-colors"
                    >
                      <img
                        src={getImageUrl(url)}
                        alt={`Evidence ${i + 1}`}
                        className="h-20 w-20 object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleUpdate} className="border-t border-slate-200 pt-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Update Status & Remarks</p>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-700">Status</label>
                <select
                  value={statusVal}
                  onChange={e => setStatusVal(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-700">Remarks / Response</label>
                <textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  rows={3}
                  placeholder="Actions taken, resolution details..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black resize-none"
                />
              </div>
              <div className="flex gap-3 justify-end pt-1">
                <Button type="button" variant="outline" onClick={() => setIsDetailOpen(false)}>Cancel</Button>
                <Button type="submit" isLoading={updateMutation.isPending}>Save Changes</Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
};
export default ComplaintManagement;
