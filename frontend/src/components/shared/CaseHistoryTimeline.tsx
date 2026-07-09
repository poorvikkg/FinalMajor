/**
 * CaseHistoryTimeline.tsx
 * Displays the complete investigation timeline for a missing person complaint.
 * Used inside the complaint detail modal.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../ui/Badge';
import api from '../../api';
import type { CaseHistory, ComplaintStatus } from '../../types';

interface Props {
  complaintId: string;
}

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  complaint_registered: 'Complaint Registered',
  under_investigation: 'Under Investigation',
  searching_cctv: 'Searching CCTV Footage',
  possible_match_found: 'Possible Match Found',
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

const getImageUrl = (url: string) => {
  const normalized = url.replace(/\\/g, '/');
  return normalized.startsWith('http') ? normalized : `/${normalized}`;
};

export const CaseHistoryTimeline: React.FC<Props> = ({ complaintId }) => {
  const { data: history = [], isLoading } = useQuery<CaseHistory[]>({
    queryKey: ['caseHistory', complaintId],
    queryFn: async () => {
      const res = await api.get(`/complaints/${complaintId}/history`);
      return res.data.data;
    },
    enabled: !!complaintId,
    staleTime: 10000,
  });

  if (isLoading) {
    return (
      <p className="text-[11px] text-slate-400 uppercase tracking-wider py-4 text-center">
        Loading timeline...
      </p>
    );
  }

  if (history.length === 0) {
    return (
      <p className="text-[11px] text-slate-400 uppercase tracking-wider py-4 text-center">
        No history entries yet.
      </p>
    );
  }

  return (
    <div className="relative pl-5">
      {/* Vertical line */}
      <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-200" />

      <div className="space-y-5">
        {history.map((entry, idx) => (
          <div key={entry._id} className="relative">
            {/* Dot */}
            <div
              className={`absolute -left-[13px] top-1 h-3 w-3 rounded-full border-2 border-white ${
                idx === 0 ? 'bg-black' : 'bg-slate-400'
              }`}
            />

            <div className="bg-slate-50 border border-slate-200 px-4 py-3 space-y-2">
              {/* Status + timestamp */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Badge variant={STATUS_VARIANT[entry.status]}>
                  {STATUS_LABELS[entry.status]}
                </Badge>
                <span className="text-[9px] font-mono text-slate-400">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>

              {/* Updated by */}
              {entry.updatedBy && (
                <p className="text-[10px] text-slate-500">
                  Updated by{' '}
                  <span className="font-bold text-slate-700">{entry.updatedBy.name}</span>
                </p>
              )}

              {/* Remarks */}
              {entry.remarks && (
                <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap border-l-2 border-slate-300 pl-2">
                  {entry.remarks}
                </p>
              )}

              {/* Detection details */}
              {(entry.cctvCameraId || entry.confidenceScore !== undefined || entry.detectionTimestamp) && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {entry.cctvCameraId && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Camera ID</p>
                      <p className="text-[11px] font-mono text-slate-700">{entry.cctvCameraId}</p>
                    </div>
                  )}
                  {entry.confidenceScore !== undefined && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Confidence</p>
                      <p className="text-[11px] font-mono text-slate-700">{entry.confidenceScore}%</p>
                    </div>
                  )}
                  {entry.detectionTimestamp && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Detected At</p>
                      <p className="text-[11px] font-mono text-slate-700">
                        {new Date(entry.detectionTimestamp).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Evidence images */}
              {entry.evidenceImages && entry.evidenceImages.length > 0 && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Evidence Images
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {entry.evidenceImages.map((url, i) => (
                      <a
                        key={i}
                        href={getImageUrl(url)}
                        target="_blank"
                        rel="noreferrer"
                        className="border border-slate-200 p-0.5 hover:border-slate-500 transition-colors"
                      >
                        <img
                          src={getImageUrl(url)}
                          alt={`Evidence ${i + 1}`}
                          className="h-16 w-16 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* SMS sent indicator */}
              {entry.smsSent && (
                <p className="text-[9px] text-green-600 font-bold uppercase tracking-wider">
                  ✓ SMS notification sent to complainant
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
