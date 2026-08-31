import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  UploadCloud,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Database,
  Info,
} from 'lucide-react';

interface FileEntry {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  message: string;
}

interface IndexStatus {
  index_exists?: boolean;
  total_vectors?: number;
  is_building?: boolean;
  [key: string]: any;
}

const ACCEPT = '.csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, .json';

function detectType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return 'csv';
  if (ext === 'json') return 'json';
  return 'excel';
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export const RagDataImport: React.FC = () => {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);
  const [building, setBuilding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<any>(null);

  const fetchIndexStatus = async () => {
    try {
      const r = await axios.get('/api/v1/ai/index/status');
      setIndexStatus(r.data);
      if (r.data.is_building) {
        setBuilding(true);
        pollRef.current = setTimeout(fetchIndexStatus, 2000);
      } else {
        setBuilding(false);
      }
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    fetchIndexStatus();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const addFiles = (newFiles: File[]) => {
    const entries: FileEntry[] = newFiles.map(f => ({ file: f, status: 'pending', message: '' }));
    setFiles(prev => [...prev, ...entries]);
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const uploadFile = async (idx: number) => {
    const entry = files[idx];
    if (!entry || entry.status === 'uploading' || entry.status === 'done') return;

    const type = detectType(entry.file.name);
    const fd = new FormData();
    fd.append('file', entry.file);

    setFiles(prev => prev.map((e, i) => (i === idx ? { ...e, status: 'uploading', message: '' } : e)));

    try {
      const r = await axios.post(`/api/v1/import/${type}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFiles(prev =>
        prev.map((e, i) =>
          i === idx ? { ...e, status: 'done', message: r.data?.message || 'Uploaded successfully.' } : e
        )
      );
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Upload failed.';
      setFiles(prev => prev.map((e, i) => (i === idx ? { ...e, status: 'error', message: msg } : e)));
    }
  };

  const uploadAll = () => files.forEach((_, i) => uploadFile(i));

  const rebuildIndex = async () => {
    setBuilding(true);
    try {
      await axios.post('/api/v1/ai/index/build', { reset: true });
      fetchIndexStatus();
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || 'Error rebuilding index');
      setBuilding(false);
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const doneCount = files.filter(f => f.status === 'done').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-md">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-wider uppercase font-heading">
              RAG Case Data Import
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              Upload CSV, Excel, or JSON datasets into vector index & database
            </p>
          </div>
        </div>

        {files.length > 0 && pendingCount > 0 && (
          <button
            onClick={uploadAll}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4" />
            Upload All ({pendingCount})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Upload Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragging
                ? 'border-slate-900 bg-slate-100 scale-[1.01]'
                : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70 hover:border-slate-400'
            }`}
          >
            <UploadCloud className={`w-10 h-10 mx-auto mb-3 ${dragging ? 'text-slate-900' : 'text-slate-400'}`} />
            <p className="text-sm font-bold text-slate-800 mb-1">
              {dragging ? 'Drop data files here' : 'Drag & drop case data files here'}
            </p>
            <p className="text-xs text-slate-500 font-medium">
              or click to browse — CSV, Excel (.xlsx), and JSON formats supported
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              onChange={onFileInput}
              className="hidden"
            />
          </div>

          {/* Files Table */}
          {files.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="p-3">File Name</th>
                    <th className="p-3">Size</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {files.map((entry, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 flex items-center gap-2 max-w-[200px]">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate" title={entry.file.name}>{entry.file.name}</span>
                      </td>
                      <td className="p-3 text-slate-500">{fmtBytes(entry.file.size)}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold uppercase text-slate-600">
                          {detectType(entry.file.name)}
                        </span>
                      </td>
                      <td className="p-3">
                        {entry.status === 'pending' && <span className="text-slate-400">Pending</span>}
                        {entry.status === 'uploading' && (
                          <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-900" /> Uploading...
                          </span>
                        )}
                        {entry.status === 'done' && (
                          <span className="flex items-center gap-1 text-emerald-600 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Done
                          </span>
                        )}
                        {entry.status === 'error' && (
                          <span className="flex items-center gap-1 text-rose-600 font-bold" title={entry.message}>
                            <AlertCircle className="w-3.5 h-3.5" /> Error
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {entry.status === 'pending' && (
                            <button
                              onClick={() => uploadFile(i)}
                              className="px-2.5 py-1 bg-slate-900 text-white text-[11px] font-bold rounded-lg hover:bg-slate-800"
                            >
                              Upload
                            </button>
                          )}
                          {entry.status === 'error' && (
                            <button
                              onClick={() => uploadFile(i)}
                              className="px-2.5 py-1 bg-slate-200 text-slate-800 text-[11px] font-bold rounded-lg hover:bg-slate-300"
                            >
                              Retry
                            </button>
                          )}
                          <button
                            onClick={() => removeFile(i)}
                            className="p-1 hover:text-rose-600 transition-colors"
                          >
                            <X className="w-4 h-4 text-slate-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {doneCount > 0 && (
                <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                  <span>{doneCount} file(s) uploaded successfully.</span>
                  <span className="font-bold text-slate-900">Rebuild AI Index to activate!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Index Sidebar Panel */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 font-heading">
                AI Vector Index Status
              </h2>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                After uploading dataset files, rebuild the FAISS vector index so the AI Intelligence pipeline can retrieve answers from new records.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2 font-medium">
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Index Built:</span>
                <span className="font-bold text-slate-900">
                  {indexStatus === null ? '—' : indexStatus.index_exists ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Total Vectors:</span>
                <span className="font-bold text-slate-900">
                  {indexStatus?.total_vectors !== undefined ? indexStatus.total_vectors.toLocaleString() : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Engine Status:</span>
                <span className={`font-bold ${building ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {building ? 'Building...' : 'Idle / Ready'}
                </span>
              </div>
            </div>

            <button
              onClick={rebuildIndex}
              disabled={building}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${building ? 'animate-spin' : ''}`} />
              {building ? 'Rebuilding Index...' : 'Rebuild AI Index'}
            </button>
          </div>

          {/* Quick Tips */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Info className="w-4 h-4 text-slate-700" />
              Dataset Import Guidelines
            </div>
            <ul className="list-disc list-inside text-slate-600 space-y-1 text-[11px] leading-relaxed">
              <li>Upload CSV/Excel containing FIR numbers, crime locations, and suspects.</li>
              <li>Upload JSON for nested case investigation details.</li>
              <li>Always click <strong>Rebuild AI Index</strong> after uploading.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
export default RagDataImport;
