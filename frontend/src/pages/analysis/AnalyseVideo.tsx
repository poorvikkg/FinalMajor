/**
 * AnalyseVideo.tsx
 * Unified video management and analysis workspace.
 * Allows uploading new recordings for automatic AI analysis and reviewing results of past videos.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import api from '../../api';

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-800">
    {children}
  </label>
);

type VideoStatus = 'uploaded' | 'queued' | 'processing' | 'completed' | 'failed';

interface VideoRecord {
  _id: string;
  originalName: string;
  size: number;
  status: VideoStatus;
  createdAt: string;
}

interface RecognitionLog {
  _id: string;
  personName?: string;
  isUnknown: boolean;
  confidence: number;
  snapshot?: string;
  timestamp: string;
}

export const AnalyseVideo: React.FC = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active view: 'list' (shows history & upload option) | 'processing' | 'results'
  const [viewState, setViewState] = useState<'list' | 'processing' | 'results'>('list');
  
  // Selection / Upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeVideoStatus, setActiveVideoStatus] = useState<VideoStatus>('uploaded');
  
  const [searchMode, setSearchMode] = useState<'database' | 'specific'>('database');
  const [targetUserId, setTargetUserId] = useState<string>('');

  // Fetch list of all uploaded/processed videos
  const { data: videos = [], isLoading: listLoading } = useQuery<VideoRecord[]>({
    queryKey: ['uploadedVideos'],
    queryFn: async () => {
      try {
        const response = await api.get('/videos?limit=50');
        return response.data.data;
      } catch {
        return [];
      }
    }
  });

  const { data: complaints = [] } = useQuery({
    queryKey: ['complaintsList'],
    queryFn: async () => {
      try {
        const response = await api.get('/complaints?limit=200');
        return response.data.data;
      } catch {
        return [];
      }
    }
  });

  // Poll video status during active analysis
  const { data: polledVideo } = useQuery<VideoRecord>({
    queryKey: ['analyseVideoStatus', activeVideoId],
    queryFn: async () => {
      const res = await api.get(`/videos/${activeVideoId}`);
      return res.data.data;
    },
    enabled: !!activeVideoId && viewState === 'processing',
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!polledVideo) return;
    setActiveVideoStatus(polledVideo.status);
    if (polledVideo.status === 'completed' || polledVideo.status === 'failed') {
      setViewState('results');
      queryClient.invalidateQueries({ queryKey: ['uploadedVideos'] });
    }
  }, [polledVideo, queryClient]);

  // Fetch face recognition results for selected completed video
  const { data: logsData, isLoading: logsLoading } = useQuery<{ data: RecognitionLog[] }>({
    queryKey: ['analyseVideoLogs', activeVideoId],
    queryFn: async () => {
      const res = await api.get(`/recognition/logs?videoId=${activeVideoId}&limit=100`);
      return res.data;
    },
    enabled: !!activeVideoId && viewState === 'results' && activeVideoStatus === 'completed',
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/videos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploadedVideos'] });
      if (activeVideoId) {
        setViewState('list');
        setActiveVideoId(null);
      }
    }
  });

  const logs = logsData?.data || [];
  const identified = logs.filter(l => !l.isUnknown);
  const unknown = logs.filter(l => l.isUnknown);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.match(/\.(mp4|avi|mkv|mov|webm)$/i)) {
        setUploadError('Invalid format. Select MP4, AVI, MKV, MOV, or WEBM.');
        return;
      }
      setUploadError(null);
      setSelectedFile(file);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(10);

    const formData = new FormData();
    formData.append('video', selectedFile);
    if (searchMode === 'specific' && targetUserId) {
      formData.append('targetUserId', targetUserId);
    }

    const interval = setInterval(() => {
      setUploadProgress(p => (p >= 85 ? 85 : p + 15));
    }, 300);

    try {
      const res = await api.post('/videos/analyse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      clearInterval(interval);
      setUploadProgress(100);

      const vid: VideoRecord = res.data.data;
      setActiveVideoId(vid._id);
      setActiveVideoStatus(vid.status);

      setTimeout(() => {
        setIsUploading(false);
        setSelectedFile(null);
        setViewState('processing');
      }, 500);
    } catch (err: any) {
      clearInterval(interval);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadError(err.response?.data?.message || 'Upload failed. Check server connection.');
    }
  };

  const inspectVideo = (vid: VideoRecord) => {
    setActiveVideoId(vid._id);
    setActiveVideoStatus(vid.status);
    if (vid.status === 'completed' || vid.status === 'failed') {
      setViewState('results');
    } else {
      setViewState('processing');
    }
  };

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest">CCTV Video Analysis</h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Upload recorded surveillance footage to detect and identify faces using AI analytics.
        </p>
      </div>

      {/* ── VIEW 1: WORKSPACE LIST & UPLOAD ── */}
      {viewState === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Form */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Submit Video</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-slate-500 p-8 text-center cursor-pointer transition-colors"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={isUploading}
                    />
                    {selectedFile ? (
                      <div>
                        <p className="text-xs font-bold text-slate-900 break-all">{selectedFile.name}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{formatSize(selectedFile.size)}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-bold text-slate-700">Choose CCTV Video</p>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase">MP4, AVI, MKV, MOV, WEBM</p>
                      </div>
                    )}
                  </div>

                  {/* Mode Selector */}
                  <div className="space-y-3 pt-2">
                    <SectionLabel>Search Mode</SectionLabel>
                    <div className="flex gap-4">
                      <label className="flex items-center space-x-2 text-xs">
                        <input
                          type="radio"
                          checked={searchMode === 'database'}
                          onChange={() => setSearchMode('database')}
                          disabled={isUploading}
                        />
                        <span>Search Entire Database</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs">
                        <input
                          type="radio"
                          checked={searchMode === 'specific'}
                          onChange={() => setSearchMode('specific')}
                          disabled={isUploading}
                        />
                        <span>Verify Specific Missing Person</span>
                      </label>
                    </div>

                    {searchMode === 'specific' && (
                      <div className="pt-2">
                        <SectionLabel>Select Missing Person</SectionLabel>
                        <select
                          value={targetUserId}
                          onChange={(e) => setTargetUserId(e.target.value)}
                          disabled={isUploading}
                          className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black"
                        >
                          <option value="">-- Select Person --</option>
                          {complaints
                            .filter((c: any) => c.attachments && c.attachments.length > 0 && c.complaintId && c.missingPersonName)
                            .map((c: any) => (
                              <option key={c._id} value={c._id}>
                                {c.missingPersonName}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {isUploading && (
                    <div className="space-y-1">
                      <div className="w-full bg-slate-150 h-1">
                        <div className="bg-slate-900 h-full transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-500 text-right">Uploading... {uploadProgress}%</p>
                    </div>
                  )}

                  {uploadError && (
                    <p className="text-[10px] font-bold text-red-700 uppercase border border-red-200 bg-red-50 px-3 py-2">
                      {uploadError}
                    </p>
                  )}

                  <Button type="submit" className="w-full" disabled={!selectedFile || isUploading}>
                    Start Analysis
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* History List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Video Repository History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="px-5 py-3">File details</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {listLoading ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-400">Loading...</td>
                        </tr>
                      ) : videos.length > 0 ? (
                        videos.map(vid => (
                          <tr key={vid._id} className="hover:bg-slate-50">
                            <td className="px-5 py-3">
                              <p className="font-bold text-slate-950 truncate max-w-xs">{vid.originalName}</p>
                              <p className="text-[10px] text-slate-400">{formatSize(vid.size)}</p>
                            </td>
                            <td className="px-5 py-3">
                              <Badge
                                variant={
                                  vid.status === 'completed' ? 'success' :
                                  vid.status === 'failed' ? 'danger' :
                                  vid.status === 'processing' ? 'warning' : 'neutral'
                                }
                              >
                                {vid.status.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="px-5 py-3 text-slate-400 font-mono text-[10px]">
                              {new Date(vid.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-5 py-3 text-right space-x-2">
                              <Button variant="outline" size="sm" onClick={() => inspectVideo(vid)}>
                                Inspect
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMutation.mutate(vid._id)}
                                className="text-red-700 hover:bg-red-50"
                              >
                                Delete
                              </Button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-400 uppercase tracking-wider">No files uploaded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── VIEW 2: AI PROCESSING STATUS ── */}
      {viewState === 'processing' && (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <div className="h-10 w-10 border-4 border-slate-200 border-t-slate-950 animate-spin mx-auto" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-900">AI Analysis Active</p>
              <p className="text-[11px] text-slate-500 mt-1">Scanning frames and running identification queries...</p>
            </div>
            <div className="inline-block border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase">
              STATUS: {activeVideoStatus.toUpperCase()}
            </div>
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={() => setViewState('list')}>
                Back to History
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── VIEW 3: ANALYSIS RESULTS ── */}
      {viewState === 'results' && (
        <div className="space-y-5">
          {/* Status Alert Bar */}
          <div className={`border p-4 flex justify-between items-center ${
            activeVideoStatus === 'failed' ? 'border-red-200 bg-red-50' : 'border-slate-300 bg-slate-50'
          }`}>
            <div>
              <p className="text-xs font-black text-slate-900 uppercase tracking-wider">
                {activeVideoStatus === 'failed' ? 'Analysis Failed' : 'Analysis Complete'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {activeVideoStatus === 'failed'
                  ? 'The video file could not be analyzed by the AI backend.'
                  : `${logs.length} face detections recorded.`}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setViewState('list')}>
              Return to Workspace
            </Button>
          </div>

          {activeVideoStatus === 'completed' && logs.length === 0 && !logsLoading && (
            <div className="border border-slate-200 bg-slate-50 p-6 text-center text-slate-500 text-xs">
              No faces detected in this video file.
            </div>
          )}

          {/* Identified Persons */}
          {identified.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Identified Individuals ({identified.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="px-5 py-3">Subject</th>
                      <th className="px-5 py-3">Confidence</th>
                      <th className="px-5 py-3">Timestamp</th>
                      <th className="px-5 py-3">Snapshot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {identified.map(log => (
                      <tr key={log._id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-bold text-slate-900">{log.personName}</td>
                        <td className="px-5 py-3 font-mono text-[11px] text-slate-600">
                          {Math.round(log.confidence * 100)}%
                        </td>
                        <td className="px-5 py-3 text-slate-400 font-mono text-[10px]">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-5 py-3">
                          {log.snapshot ? (
                            <img src={`/uploads/${log.snapshot}`} alt="Face" className="h-10 w-10 object-cover border" />
                          ) : (
                            <span className="text-[10px] text-slate-300 font-bold uppercase">No Snapshot</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Unknown Faces Grid */}
          {unknown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Unidentified Subject Detections ({unknown.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {unknown.map(log => (
                    <div key={log._id} className="border border-slate-200 p-2 text-center bg-white space-y-1">
                      {log.snapshot ? (
                        <img src={`/uploads/${log.snapshot}`} alt="Unknown Face" className="w-full aspect-square object-cover border" />
                      ) : (
                        <div className="w-full aspect-square bg-slate-55 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
                          No photo
                        </div>
                      )}
                      <p className="text-[10px] font-mono text-slate-500">Conf: {Math.round(log.confidence * 100)}%</p>
                      <p className="text-[9px] text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setViewState('list')}>
              Close Results
            </Button>
            <Button onClick={() => window.location.href = '/file-case'}>
              File a Case Report
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyseVideo;
