import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Activity,
  Database,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Cpu,
  Brain,
  ShieldCheck,
} from 'lucide-react';

const QUICK_QUERIES = [
  'Show all pending cases',
  'List unsolved murder cases',
  'How many FIRs were filed this month?',
  'Show cases assigned to Inspector Sharma',
  'Crime statistics by district',
  'Cases with missing persons filed in 2024',
];

interface HealthStatus {
  service?: string;
  version?: string;
  [key: string]: any;
}

interface IndexStatus {
  index_exists?: boolean;
  total_vectors?: number;
  is_building?: boolean;
  [key: string]: any;
}

export const RagDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [index, setIndex] = useState<IndexStatus | null>(null);
  const [loadingH, setLoadingH] = useState(true);
  const [loadingI, setLoadingI] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = () => {
    setLoadingH(true);
    axios
      .get('/health')
      .then(r => setHealth(r.data))
      .catch(() => setHealth(null))
      .finally(() => setLoadingH(false));
  };

  const fetchIndex = () => {
    setLoadingI(true);
    axios
      .get('/api/v1/ai/index/status')
      .then(r => setIndex(r.data))
      .catch(() => setIndex(null))
      .finally(() => setLoadingI(false));
  };

  const refresh = () => {
    setRefreshing(true);
    Promise.all([
      axios.get('/health').then(r => setHealth(r.data)).catch(() => setHealth(null)),
      axios.get('/api/v1/ai/index/status').then(r => setIndex(r.data)).catch(() => setIndex(null)),
    ]).finally(() => {
      setRefreshing(false);
      setLoadingH(false);
      setLoadingI(false);
    });
  };

  useEffect(() => {
    fetchHealth();
    fetchIndex();
  }, []);

  const isOnline = Boolean(health);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-md">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-wider uppercase font-heading">
              RAG Intelligence Analytics
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              System health, vector database index status, and AI query engine status
            </p>
          </div>
        </div>

        <button
          onClick={refresh}
          disabled={refreshing}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Health Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Backend Status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Backend Service
            </span>
            <Cpu className="w-4 h-4 text-slate-400" />
          </div>
          {loadingH ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" /> Checking API...
            </div>
          ) : isOnline ? (
            <div>
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" /> Online
              </div>
              <p className="text-xs font-semibold text-slate-800 mt-1">{health?.service || 'PCIS Backend'}</p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">v{health?.version || '1.0.0'}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <XCircle className="w-4 h-4" /> Offline
            </div>
          )}
        </div>

        {/* FAISS Index Status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              AI Vector Index (FAISS)
            </span>
            <Database className="w-4 h-4 text-slate-400" />
          </div>
          {loadingI ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" /> Checking Index...
            </div>
          ) : index ? (
            <div>
              <div className="flex items-center gap-2 text-sm font-bold">
                {index.index_exists ? (
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" /> Vector Index Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <XCircle className="w-4 h-4" /> Not Built
                  </span>
                )}
              </div>
              {index.total_vectors !== undefined && (
                <p className="text-xs font-semibold text-slate-700 mt-1">
                  {index.total_vectors.toLocaleString()} vectors indexed
                </p>
              )}
              {index.is_building && (
                <p className="text-[11px] font-bold text-amber-600 flex items-center gap-1 mt-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Index building in background...
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 font-medium">Could not connect to AI index service.</p>
          )}
        </div>

        {/* AI Components */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              AI Pipeline Components
            </span>
            <ShieldCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="space-y-1.5 pt-1">
            {[
              { label: 'LLM (Groq / Llama-3)', ok: isOnline },
              { label: 'MongoDB Case Storage', ok: isOnline },
              { label: 'HuggingFace Embeddings', ok: isOnline },
              { label: 'LangGraph Reasoning Node', ok: isOnline },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center gap-2 text-xs font-medium">
                {ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                )}
                <span className={ok ? 'text-slate-800' : 'text-slate-400'}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions & Queries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 font-heading">
            Quick Actions
          </h2>
          <div className="space-y-2.5">
            <button
              onClick={() => navigate('/rag/chat')}
              className="w-full p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-sm transition-all"
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Ask RAG AI Intelligence
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/rag/import')}
              className="w-full p-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-between border border-slate-200 transition-all"
            >
              <span className="flex items-center gap-2">
                <Database className="w-4 h-4" /> Upload & Import Case Data
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 font-heading">
            Suggested RAG Queries
          </h2>
          <div className="space-y-1.5">
            {QUICK_QUERIES.slice(0, 4).map(q => (
              <button
                key={q}
                onClick={() => navigate('/rag/chat', { state: { prefill: q } })}
                className="w-full p-2 hover:bg-slate-50 rounded-xl text-left text-xs font-medium text-slate-700 flex items-center justify-between group border border-transparent hover:border-slate-200 transition-all"
              >
                <span className="truncate">{q}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
export default RagDashboard;
