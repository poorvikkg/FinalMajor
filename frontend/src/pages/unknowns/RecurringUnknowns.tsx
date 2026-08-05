import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/shared/DataTable';
import api from '../../api';
import type { UnknownPerson, UnknownPersonStatus } from '../../types';
import {
  UserSearch,
  ShieldAlert,
  Repeat,
  CheckCircle2,
  Search,
  Eye,
} from 'lucide-react';

import { getSnapshotUrl } from '../../utils/pathPrediction';
import { SightingMap } from '../../components/map/SightingMap';


export function RecurringUnknowns() {
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'all' | 'recurring' | 'review'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<UnknownPerson | null>(null);
  const [modalTab, setModalTab] = useState<'timeline' | 'map' | 'review'>('timeline');

  // Human Review Form State
  const [reviewAction, setReviewAction] = useState<'reviewed' | 'associated' | 'dismissed'>('reviewed');
  const [caseIdInput, setCaseIdInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

  const queryClient = useQueryClient();

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['unknownPersonStats'],
    queryFn: async () => {
      const res = await api.get('/unknown-persons/stats');
      return res.data.data;
    },
    refetchInterval: 8000,
  });

  // Fetch unknown persons list
  const { data, isLoading } = useQuery({
    queryKey: ['unknownPersons', page, activeTab],
    queryFn: async () => {
      let endpoint = `/unknown-persons?page=${page}&limit=10`;
      if (activeTab === 'recurring') endpoint = `/unknown-persons/recurring?page=${page}&limit=10`;
      if (activeTab === 'review') endpoint = `/unknown-persons/review-required?page=${page}&limit=10`;

      const res = await api.get(endpoint);
      return res.data;
    },
    refetchInterval: 8000,
  });

  // Review submission mutation
  const reviewMutation = useMutation({
    mutationFn: async ({
      unknownId,
      action,
      notes,
      caseId,
    }: {
      unknownId: string;
      action: 'reviewed' | 'associated' | 'dismissed';
      notes?: string;
      caseId?: string;
    }) => {
      await api.post(`/unknown-persons/${unknownId}/review`, {
        action,
        notes,
        caseId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unknownPersons'] });
      queryClient.invalidateQueries({ queryKey: ['unknownPersonStats'] });
      setSelectedPerson(null);
      setNotesInput('');
      setCaseIdInput('');
    },
  });

  // Delete unknown person mutation
  const deleteUnknownMutation = useMutation({
    mutationFn: async (unknownId: string) => {
      await api.delete(`/unknown-persons/${unknownId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unknownPersons'] });
      queryClient.invalidateQueries({ queryKey: ['unknownPersonStats'] });
    },
  });

  const rawList: UnknownPerson[] = data?.data || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1 };
  const stats = statsData || { total: 0, recurring: 0, reviewRequired: 0, reviewed: 0 };

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return rawList;
    const q = searchQuery.toLowerCase().trim();
    return rawList.filter((item) => item.unknownId.toLowerCase().includes(q));
  }, [rawList, searchQuery]);

  const renderStatusBadge = (status: UnknownPersonStatus) => {
    switch (status) {
      case 'REVIEW_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white border border-slate-900">
            <ShieldAlert className="h-3 w-3" />
            Review Required
          </span>
        );
      case 'RECURRING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-700 text-white border border-slate-700">
            <Repeat className="h-3 w-3" />
            Recurring
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
            <UserSearch className="h-3 w-3" />
            Unknown
          </span>
        );
    }
  };

  const columns = [
    {
      header: 'Anonymous Identity',
      accessor: (row: UnknownPerson) => (
        <div className="flex items-center gap-3">
          {row.representativeSnapshot ? (
            <img
              src={getSnapshotUrl(row.representativeSnapshot)}
              alt="Profile"
              className="w-10 h-10 rounded border border-slate-200 object-cover shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
              <UserSearch className="h-5 w-5" />
            </div>
          )}
          <div>
            <p className="font-mono font-bold text-xs text-slate-900">{row.unknownId}</p>
            <p className="text-[11px] text-slate-500">
              First seen {new Date(row.firstSeen).toLocaleDateString()}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Recurrence Status',
      accessor: (row: UnknownPerson) => renderStatusBadge(row.status),
    },
    {
      header: 'Occurrences',
      accessor: (row: UnknownPerson) => (
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-slate-800">
            {row.distinctVideoCount} Videos / {row.distinctCameraCount} Cameras
          </p>
          <p className="text-[11px] text-slate-500 font-mono">
            {row.appearanceCount} total detections
          </p>
        </div>
      ),
    },
    {
      header: 'Review Audit',
      accessor: (row: UnknownPerson) =>
        row.isReviewed ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 text-[10px] font-bold uppercase tracking-wider">
            <CheckCircle2 className="h-3 w-3 text-slate-700" />
            {row.reviewAction || 'Reviewed'}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Pending</span>
        ),
    },
    {
      header: 'Last Detected',
      accessor: (row: UnknownPerson) => (
        <div className="text-slate-600 font-mono text-xs">
          <p>{new Date(row.lastSeen).toLocaleDateString()}</p>
          <p className="text-[10px] text-slate-400">{new Date(row.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: (row: UnknownPerson) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-semibold"
            onClick={() => {
              setSelectedPerson(row);
              setModalTab('timeline');
              setReviewAction('reviewed');
              setNotesInput(row.reviewNotes || '');
            }}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-colors"
            onClick={() => {
              if (window.confirm(`Are you sure you want to delete unknown identity ${row.unknownId}?`)) {
                deleteUnknownMutation.mutate(row.unknownId);
              }
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Recurring Unknown Persons
        </h1>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Anonymous
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {stats.total}
              </p>
            </div>
            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg">
              <UserSearch className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Recurring (4+ Videos)
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {stats.recurring}
              </p>
            </div>
            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg">
              <Repeat className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Review Required (11+)
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {stats.reviewRequired}
              </p>
            </div>
            <div className="p-2.5 bg-slate-900 text-white rounded-lg">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Human Reviewed
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {stats.reviewed}
              </p>
            </div>
            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar: Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-2 rounded-lg border border-slate-200">
        <div className="flex bg-slate-100 p-1 rounded-md gap-1">
          <button
            onClick={() => { setActiveTab('all'); setPage(1); }}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => { setActiveTab('recurring'); setPage(1); }}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeTab === 'recurring'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Recurring ({stats.recurring})
          </button>
          <button
            onClick={() => { setActiveTab('review'); setPage(1); }}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeTab === 'review'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Review Required ({stats.reviewRequired})
          </button>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search identity ID..."
            className="w-full pl-9 pr-3 py-1.5 rounded text-xs border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border-slate-200">
        <CardHeader className="py-3 border-b border-slate-100">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Anonymous Clusters Registry
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filteredList}
            isLoading={isLoading}
            pagination={{
              page: pagination.page,
              totalPages: pagination.totalPages,
              onPageChange: setPage,
            }}
            emptyMessage="No anonymous identities found matching the query."
          />
        </CardContent>
      </Card>

      {/* Detail & Review Modal */}
      <Modal
        isOpen={!!selectedPerson}
        onClose={() => setSelectedPerson(null)}
        title={`Identity File: ${selectedPerson?.unknownId}`}
      >
        {selectedPerson && (
          <div className="space-y-5 select-none">
            {/* Header Box */}
            <div className="flex gap-4 items-start bg-slate-900 text-white p-4 rounded-lg">
              {selectedPerson.representativeSnapshot ? (
                <img
                  src={getSnapshotUrl(selectedPerson.representativeSnapshot)}
                  alt="Profile"
                  className="w-20 h-20 rounded border border-slate-700 object-cover shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  <UserSearch className="h-8 w-8" />
                </div>
              )}

              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold">
                    {selectedPerson.unknownId}
                  </span>
                  {renderStatusBadge(selectedPerson.status)}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-300">
                  <p>First Spotted: {new Date(selectedPerson.firstSeen).toLocaleString()}</p>
                  <p>Last Spotted: {new Date(selectedPerson.lastSeen).toLocaleString()}</p>
                  <p>Distinct Videos: {selectedPerson.distinctVideoCount}</p>
                  <p>Distinct Cameras: {selectedPerson.distinctCameraCount}</p>
                </div>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
              <button
                onClick={() => setModalTab('timeline')}
                className={`pb-2 transition-colors ${
                  modalTab === 'timeline'
                    ? 'text-slate-900 border-b-2 border-slate-900'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                Sighting Timeline ({selectedPerson.appearances?.length || 0})
              </button>
              <button
                onClick={() => setModalTab('map')}
                className={`pb-2 transition-colors ${
                  modalTab === 'map'
                    ? 'text-slate-900 border-b-2 border-slate-900'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                Geospatial Sighting Map
              </button>
              <button
                onClick={() => setModalTab('review')}
                className={`pb-2 transition-colors ${
                  modalTab === 'review'
                    ? 'text-slate-900 border-b-2 border-slate-900'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                Human Review & Audit
              </button>
            </div>

            {/* Tab 1: Timeline */}
            {modalTab === 'timeline' && (
              <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2">
                {(!selectedPerson.appearances || selectedPerson.appearances.length === 0) ? (
                  <p className="text-xs text-slate-400 italic py-6 text-center">No detailed appearance records available.</p>
                ) : (
                  selectedPerson.appearances.map((app, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-2.5 bg-slate-50 rounded border border-slate-200 text-xs"
                    >
                      {app.snapshotObjectKey ? (
                        <img
                          src={getSnapshotUrl(app.snapshotObjectKey)}
                          alt="Snapshot"
                          className="w-12 h-12 rounded object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-bold shrink-0">
                          N/A
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-slate-900 truncate">
                            {app.videoId?.originalName ? (
                              <span>Video: {app.videoId.originalName}</span>
                            ) : app.cameraId?.name ? (
                              <span>Camera: {app.cameraId.name} ({app.cameraId.location})</span>
                            ) : (
                              <span>Recorded Sighting</span>
                            )}
                          </p>
                          <span className="font-mono text-[10px] text-slate-500 font-bold">
                            {Math.round(app.similarity * 100)}% match
                          </span>
                        </div>
                        <p className="text-slate-500 font-mono text-[11px]">
                          {new Date(app.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: Geospatial Map */}
            {modalTab === 'map' && (
              <div className="space-y-2">
                <SightingMap
                  sightings={
                    selectedPerson.appearances?.map((app: any, idx: number) => ({
                      _id: app._id || `app-${idx}`,
                      identityType: 'UNKNOWN',
                      unknownPersonId: {
                        _id: selectedPerson._id,
                        unknownId: selectedPerson.unknownId,
                        status: selectedPerson.status,
                      },
                      sourceType: app.cameraId ? 'LIVE_CCTV' : 'UPLOADED_VIDEO',
                      location: {
                        name: app.cameraId?.location?.name || app.cameraId?.location || app.videoId?.location?.name || 'Sighting Location',
                        latitude: app.cameraId?.location?.latitude || app.videoId?.location?.latitude || 12.9141,
                        longitude: app.cameraId?.location?.longitude || app.videoId?.location?.longitude || 74.856,
                      },
                      locationAvailable: true,
                      detectedAt: app.timestamp,
                      similarity: app.similarity || 0.5,
                      snapshotObjectKey: app.snapshotObjectKey,
                      createdAt: app.timestamp,
                      updatedAt: app.timestamp,
                    })) as any[] || []
                  }
                  height="360px"
                  showSequenceLine={true}
                />
              </div>
            )}

            {/* Tab 2: Review Form & Audit */}
            {modalTab === 'review' && (
              <div className="space-y-4 text-xs">
                {selectedPerson.isReviewed && (
                  <div className="bg-slate-100 border border-slate-200 rounded p-3 text-slate-800 space-y-1">
                    <p className="font-bold">Completed Review</p>
                    <p>Action: <span className="uppercase font-semibold">{selectedPerson.reviewAction}</span></p>
                    {selectedPerson.reviewNotes && <p className="italic text-slate-600">"{selectedPerson.reviewNotes}"</p>}
                  </div>
                )}

                <div className="space-y-3">
                  <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Select Action
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setReviewAction('reviewed')}
                      className={`p-2.5 rounded font-bold border transition-colors ${
                        reviewAction === 'reviewed'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Mark Reviewed
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewAction('associated')}
                      className={`p-2.5 rounded font-bold border transition-colors ${
                        reviewAction === 'associated'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Associate Case
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewAction('dismissed')}
                      className={`p-2.5 rounded font-bold border transition-colors ${
                        reviewAction === 'dismissed'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Dismiss
                    </button>
                  </div>

                  {reviewAction === 'associated' && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Case ID / FIR Number
                      </label>
                      <input
                        type="text"
                        value={caseIdInput}
                        onChange={(e) => setCaseIdInput(e.target.value)}
                        placeholder="Enter Case ID..."
                        className="w-full p-2 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Investigation Remarks
                    </label>
                    <textarea
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      rows={3}
                      placeholder="Add investigation remarks..."
                      className="w-full p-2 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setSelectedPerson(null)}>
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    className="bg-slate-900 text-white font-bold"
                    onClick={() =>
                      reviewMutation.mutate({
                        unknownId: selectedPerson.unknownId,
                        action: reviewAction,
                        notes: notesInput,
                        caseId: caseIdInput || undefined,
                      })
                    }
                    disabled={reviewMutation.isPending}
                  >
                    {reviewMutation.isPending ? 'Saving...' : 'Save Decision'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
