import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CaseHistoryTimeline } from '../../components/shared/CaseHistoryTimeline';
import type { Complaint, ComplaintStatus } from '../../types';
import { useAuthStore } from '../../store/auth';
import api from '../../api';

// ── Label maps ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  complaint_registered: 'Complaint Registered',
  under_investigation: 'Under Investigation',
  searching_cctv: 'Searching CCTV',
  possible_match_found: 'Possible Match',
  match_confirmed: 'Match Confirmed',
  false_match: 'False Match',
  person_found: 'Person Found',
  case_closed: 'Case Closed',
};

const STATUS_VARIANT: Record<ComplaintStatus, 'neutral' | 'warning' | 'success' | 'danger'> = {
  complaint_registered: 'neutral',
  under_investigation: 'neutral',
  searching_cctv: 'warning',
  possible_match_found: 'warning',
  match_confirmed: 'success',
  false_match: 'danger',
  person_found: 'success',
  case_closed: 'neutral',
};

// Removed PRIORITY_VARIANT as priority does not exist

const getImageUrl = (url: string) => {
  const n = url.replace(/\\/g, '/');
  return n.startsWith('http') ? n : `/${n}`;
};

const ALL_STATUSES: ComplaintStatus[] = [
  'complaint_registered',
  'under_investigation',
  'searching_cctv',
  'possible_match_found',
  'match_confirmed',
  'false_match',
  'person_found',
  'case_closed',
];

// ── Sub-components ───────────────────────────────────────────────────────────

const InfoRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) =>
  value ? (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-xs text-slate-800 mt-0.5 break-words">{value}</p>
    </div>
  ) : null;

// ── Main Component ───────────────────────────────────────────────────────────

export const ComplaintManagement: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isViewer = user?.role === 'station' || user?.role === 'viewer';
  const isOperator = user?.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');

  // Status update form state (operator)
  const [newStatus, setNewStatus] = useState<ComplaintStatus>('complaint_registered');
  const [updateRemarks, setUpdateRemarks] = useState('');
  const [cctvCameraId, setCctvCameraId] = useState('');
  const [confidenceScore, setConfidenceScore] = useState('');
  const [detectionTimestamp, setDetectionTimestamp] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const { data: tickets = [], isLoading } = useQuery<Complaint[]>({
    queryKey: ['complaintsList'],
    queryFn: async () => {
      const r = await api.get('/complaints?limit=200');
      return r.data.data;
    },
    refetchInterval: isViewer ? 30000 : 15000,
  });

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) => {
      await api.patch(`/complaints/${id}/status`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaintsList'] });
      queryClient.invalidateQueries({ queryKey: ['caseHistory', selected?._id] });
      setUpdateError(null);
      setEvidenceFiles([]);
      setUpdateRemarks('');
      setCctvCameraId('');
      setConfidenceScore('');
      setDetectionTimestamp('');
      // Switch to history tab to show the newly added entry
      setEvidenceFiles([]);
    },
    onError: (err: any) => {
      setUpdateError(err.response?.data?.message || 'Update failed');
    },
  });

  const removeAttachmentMutation = useMutation({
    mutationFn: async ({ id, url }: { id: string; url: string }) => {
      await api.delete(`/complaints/${id}/attachments`, { data: { url } });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['complaintsList'] });
      if (selected) {
        // Optimistically update the selected complaint so the UI reflects the change immediately
        setSelected({ ...selected, attachments: selected.attachments?.filter(att => att !== variables.url) });
      }
    },
  });

  const deleteComplaintMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/complaints/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaintsList'] });
      setIsDetailOpen(false);
      setSelected(null);
    }
  });

  const openDetail = (t: Complaint) => {
    setSelected(t);
    setNewStatus(t.status);
    setUpdateRemarks('');
    setCctvCameraId('');
    setConfidenceScore('');
    setDetectionTimestamp('');
    setEvidenceFiles([]);
    setUpdateError(null);
    setActiveTab('details');
    setIsDetailOpen(true);
  };

  const handleStatusUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    const fd = new FormData();
    fd.append('status', newStatus);
    if (updateRemarks) fd.append('remarks', updateRemarks);
    if (cctvCameraId) fd.append('cctvCameraId', cctvCameraId);
    if (confidenceScore) fd.append('confidenceScore', confidenceScore);
    if (detectionTimestamp) fd.append('detectionTimestamp', new Date(detectionTimestamp).toISOString());
    evidenceFiles.forEach((f) => fd.append('evidenceImages', f));

    statusUpdateMutation.mutate({ id: selected._id, formData: fd });
  };

  const handleEvidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setEvidenceFiles(Array.from(e.target.files));
    }
  };

  const filtered = tickets.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      (t.missingPersonName && t.missingPersonName.toLowerCase().includes(q)) ||
      (t.reporterName && t.reporterName.toLowerCase().includes(q)) ||
      (t.complaintId && t.complaintId.toLowerCase().includes(q)) ||
      (t.lastSeenLocation && t.lastSeenLocation.toLowerCase().includes(q))
    );
  });

  // ── VIEWER VIEW ──────────────────────────────────────────
  if (isViewer) {
    return (
      <div className="space-y-5 max-w-3xl">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest">All Complaints</h1>
            <p className="text-xs text-slate-500 mt-0.5">Track all submitted missing person reports. Auto-refreshes every 30 seconds.</p>
          </div>
          <Button onClick={() => navigate('/file-case')}>File New Report</Button>
        </div>

        {tickets.length === 0 && !isLoading && (
          <div className="border border-slate-200 bg-slate-50 px-5 py-10 text-center">
            <p className="text-xs font-black text-slate-600 uppercase tracking-widest">No reports filed yet.</p>
            <p className="text-[11px] text-slate-400 mt-1">Click "File New Report" to submit a missing person report.</p>
          </div>
        )}

        <div className="space-y-3">
          {isLoading ? (
            <p className="text-[11px] text-slate-400 uppercase tracking-wider px-1">Loading...</p>
          ) : (
            filtered.map((t) => (
              <div
                key={t._id}
                onClick={() => openDetail(t)}
                className="border border-slate-200 bg-white px-5 py-4 cursor-pointer hover:border-slate-400 transition-colors"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.complaintId && (
                        <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5">
                          {t.complaintId}
                        </span>
                      )}
                      <p className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        {t.missingPersonName || 'Unknown Subject'}
                      </p>
                      <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      <span className="font-bold">Last Seen:</span> {t.lastSeenLocation}
                    </p>
                    {t.remarks && (
                      <div className="border-l-2 border-slate-400 pl-2 mt-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Latest Remark:</p>
                        <p className="text-[11px] text-slate-700">{t.remarks}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-slate-400 shrink-0">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Viewer detail modal */}
        {selected && (
          <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title={`Report — ${selected.complaintId || selected._id}`}>
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex border-b border-slate-200">
                {(['details', 'history'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-[11px] font-black uppercase tracking-wider border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-black text-black'
                        : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    {tab === 'details' ? 'Case Details' : 'Timeline'}
                  </button>
                ))}
              </div>

              {activeTab === 'details' ? (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={STATUS_VARIANT[selected.status]}>{STATUS_LABELS[selected.status]}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow label="Subject" value={selected.missingPersonName || 'Unknown'} />
                    <InfoRow label="Age / Gender" value={`${selected.age || '?'} / ${selected.gender}`} />
                    <InfoRow label="Last Seen" value={selected.lastSeenLocation} />
                    <InfoRow label="Last Seen Time" value={new Date(selected.lastSeenTime).toLocaleString()} />
                    <InfoRow label="Clothes Worn" value={selected.clothesWorn} />
                    <InfoRow label="Identifying Marks" value={selected.identifyingMarks} />
                  </div>
                  {selected.remarks && (
                    <div className="border-l-2 border-slate-400 pl-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Latest Remark</p>
                      <p className="text-[11px] text-slate-700 mt-0.5">{selected.remarks}</p>
                    </div>
                  )}
                </div>
              ) : (
                <CaseHistoryTimeline complaintId={selected._id} />
              )}

              <div className="flex justify-between pt-2 border-t border-slate-100 items-center">
                {(user?.role === 'admin' || user?.role === 'station') ? (
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to permanently delete this complaint? This cannot be undone.')) {
                        deleteComplaintMutation.mutate(selected._id);
                      }
                    }}
                    className="text-[11px] font-bold text-red-600 hover:text-red-700 uppercase tracking-wider px-3"
                    title="Delete Complaint"
                  >
                    {deleteComplaintMutation.isPending ? 'Deleting...' : 'Delete Case'}
                  </button>
                ) : <div />}
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // ── ADMIN / OPERATOR VIEW ────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest">Missing Person Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage cases, update status, and view investigation timelines.</p>
        </div>
        <Button onClick={() => navigate('/file-case')}>New Report</Button>
      </div>

      <Input
        placeholder="Search by name, complaint ID, location..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="px-5 py-3">Complaint ID</th>
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-5 py-3">Reporter</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Filed</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-[11px] text-slate-400 uppercase tracking-wider">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((t) => (
                    <tr key={t._id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-600">{t.complaintId || '—'}</td>
                      <td className="px-5 py-3 font-semibold text-slate-900">{t.missingPersonName || 'Unknown'}</td>
                      <td className="px-5 py-3">
                        <p className="font-bold text-slate-900">{t.reporterName}</p>
                        <p className="text-[10px] text-slate-400">{t.reporterMobile}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-400">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => openDetail(t)}>
                          Manage
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-[11px] text-slate-400 uppercase tracking-wider">
                      No reports found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Detail / Manage Modal ─────────────────────────── */}
      {selected && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`Case — ${selected.complaintId || selected._id}`}
        >
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex justify-between items-center border-b border-slate-200">
              <div className="flex">
                {(['details', 'history'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-[11px] font-black uppercase tracking-wider border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-black text-black'
                        : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    {tab === 'details' ? 'Case Details' : 'Investigation Timeline'}
                  </button>
                ))}
              </div>
              {(user?.role === 'admin' || user?.role === 'station') && (
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to permanently delete this complaint? This cannot be undone.')) {
                      deleteComplaintMutation.mutate(selected._id);
                    }
                  }}
                  className="text-[11px] font-bold text-red-600 hover:text-red-700 uppercase tracking-wider px-3"
                  title="Delete Complaint"
                >
                  {deleteComplaintMutation.isPending ? 'Deleting...' : 'Delete Case'}
                </button>
              )}
            </div>

            {activeTab === 'details' ? (
              <div className="space-y-5 text-xs max-h-[60vh] overflow-y-auto pr-1">
                {/* Status badges */}
                <div className="flex gap-2 flex-wrap">
                  <Badge variant={STATUS_VARIANT[selected.status]}>{STATUS_LABELS[selected.status]}</Badge>
                </div>

                {/* Missing Person */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 border-b border-slate-100 pb-1">
                    Missing Person
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoRow label="Full Name" value={selected.missingPersonName || 'Unknown'} />
                    <InfoRow label="Age" value={selected.age} />
                    <InfoRow label="Gender" value={selected.gender} />
                    <InfoRow label="Height" value={selected.height} />
                    <InfoRow label="Weight" value={selected.weight} />
                    <InfoRow label="Skin Tone" value={selected.skinTone} />
                    <InfoRow label="Hair Color" value={selected.hairColor} />
                    <InfoRow label="Eye Color" value={selected.eyeColor} />
                    <InfoRow label="Last Seen Location" value={selected.lastSeenLocation} />
                    <InfoRow label="Last Seen Time" value={new Date(selected.lastSeenTime).toLocaleString()} />
                  </div>
                  {selected.clothesWorn && (
                    <div className="mt-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Clothes Worn</p>
                      <p className="text-xs text-slate-700 mt-0.5 whitespace-pre-wrap">{selected.clothesWorn}</p>
                    </div>
                  )}
                  {selected.identifyingMarks && (
                    <div className="mt-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Identifying Marks</p>
                      <p className="text-xs text-slate-700 mt-0.5 whitespace-pre-wrap">{selected.identifyingMarks}</p>
                    </div>
                  )}
                  {selected.medicalConditions && (
                    <div className="mt-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Medical Conditions</p>
                      <p className="text-xs text-slate-700 mt-0.5 whitespace-pre-wrap">{selected.medicalConditions}</p>
                    </div>
                  )}
                  {selected.additionalDescription && (
                    <div className="mt-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Additional Info</p>
                      <p className="text-xs text-slate-700 mt-0.5 whitespace-pre-wrap">{selected.additionalDescription}</p>
                    </div>
                  )}
                </div>

                {/* Photos */}
                {selected.attachments && selected.attachments.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Photos</p>
                    <div className="flex flex-wrap gap-2">
                      {selected.attachments.map((url, i) => (
                        <div key={i} className="relative group border border-slate-200 p-0.5 hover:border-slate-500 transition-colors">
                          <a href={getImageUrl(url)} target="_blank" rel="noreferrer" className="block">
                            <img src={getImageUrl(url)} alt={`Photo ${i + 1}`} className="h-20 w-20 object-cover" />
                          </a>
                          {isOperator && (
                            <button
                              onClick={() => removeAttachmentMutation.mutate({ id: selected._id, url })}
                              className="absolute top-0 right-0 bg-red-600 text-white p-1 rounded-bl text-[9px] opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete Photo"
                            >
                              X
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Complainant */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 border-b border-slate-100 pb-1">
                    Complainant
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoRow label="Name" value={selected.reporterName} />
                    <InfoRow label="Relationship" value={selected.reporterRelationship} />
                    <InfoRow label="Mobile" value={selected.reporterMobile} />
                    <InfoRow label="Alt Mobile" value={selected.reporterAltMobile} />
                    <InfoRow label="Email" value={selected.reporterEmail} />
                    <InfoRow label="Govt ID" value={selected.reporterGovtId} />
                  </div>
                  {selected.reporterAddress && (
                    <div className="mt-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Address</p>
                      <p className="text-xs text-slate-700 mt-0.5">{selected.reporterAddress}</p>
                    </div>
                  )}
                </div>

                {/* Police */}
                {(selected.policeStation || selected.officerName) && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 border-b border-slate-100 pb-1">
                      Police Case
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoRow label="Police Station" value={selected.policeStation} />
                      <InfoRow label="Officer Name" value={selected.officerName} />
                    </div>
                  </div>
                )}

                {/* Status Update Form (operator/admin only) */}
                {isOperator && (
                  <form onSubmit={handleStatusUpdate} className="border-t border-slate-200 pt-4 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Update Case Status</p>

                    {updateError && (
                      <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 px-3 py-2">{updateError}</p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-700">New Status *</label>
                        <select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value as ComplaintStatus)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black"
                          required
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-700">CCTV Camera ID</label>
                        <input
                          type="text"
                          value={cctvCameraId}
                          onChange={(e) => setCctvCameraId(e.target.value)}
                          placeholder="e.g. CAM-042"
                          className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-700">Confidence Score (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={confidenceScore}
                          onChange={(e) => setConfidenceScore(e.target.value)}
                          placeholder="e.g. 87"
                          className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-700">Detection Timestamp</label>
                        <input
                          type="datetime-local"
                          value={detectionTimestamp}
                          onChange={(e) => setDetectionTimestamp(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-700">Remarks / Investigation Notes</label>
                      <textarea
                        value={updateRemarks}
                        onChange={(e) => setUpdateRemarks(e.target.value)}
                        rows={3}
                        placeholder="Investigation updates, observations, next steps..."
                        className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-700">
                        Evidence / Detection Screenshots
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleEvidenceChange}
                        className="text-[11px] text-slate-600"
                      />
                      {evidenceFiles.length > 0 && (
                        <p className="text-[10px] text-slate-400 mt-1">{evidenceFiles.length} file(s) selected</p>
                      )}
                    </div>

                    <div className="flex gap-3 justify-end">
                      <Button type="button" variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
                      <Button type="submit" isLoading={statusUpdateMutation.isPending}>Update Status</Button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <CaseHistoryTimeline complaintId={selected._id} />
                <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
                  <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Close</Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
