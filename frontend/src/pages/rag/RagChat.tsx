import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Paperclip,
  X,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Trash2,
  AlertCircle,
  Copy,
  Check,
  Bot,
  Sparkles,
} from 'lucide-react';

/* ── Types & Interfaces ──────────────────────────────── */
interface SourceDoc {
  title?: string;
  source?: string;
  text?: string;
  [key: string]: any;
}

interface Message {
  id: number;
  role: 'assistant' | 'user' | 'error';
  content: string;
  streaming?: boolean;
  intent?: string;
  confidence?: string;
  sources?: (string | SourceDoc)[];
  mongoCount?: number;
  vectorCount?: number;
  attachmentName?: string | null;
}

interface AttachmentState {
  file: File;
  uploading: boolean;
  done: boolean;
  error: string | null;
}

const QUICK_QUERIES = [
  'Show all pending cases',
  'List unsolved murder cases',
  'How many FIRs filed this month?',
  'Crime statistics by district',
  'Show cases filed in 2024',
  'Cases with arrested suspects',
];

const ACCEPT_TYPES = '.csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, .json';

function detectUploadType(filename: string): 'csv' | 'json' | 'excel' {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return 'csv';
  if (ext === 'json') return 'json';
  return 'excel';
}

function confidenceClass(conf?: string): string {
  if (!conf) return 'bg-slate-100 text-slate-700 border-slate-200';
  const c = conf.toUpperCase();
  if (c === 'HIGH') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (c === 'MEDIUM') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (c === 'LOW') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function downloadTxt(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPdf(text: string, filename: string) {
  const html = `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>${filename}</title>
    <style>
      body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size:13px; line-height:1.7; max-width:700px; margin:40px auto; color:#111; }
      h1 { font-size:16px; border-bottom:1px solid #ccc; padding-bottom:8px; margin-bottom:16px; }
      pre { white-space:pre-wrap; word-wrap:break-word; }
    </style>
  </head><body>
    <h1>PCIS Intelligence Report</h1>
    <pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      win.print();
      URL.revokeObjectURL(url);
    };
  }
}

/* ── Markdown Content Renderer ───────────────────────── */
const MarkdownRenderer: React.FC<{ content: string; streaming?: boolean }> = ({ content, streaming }) => {
  return (
    <div className="text-xs leading-relaxed text-slate-800 font-sans overflow-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3 rounded-xl border border-slate-200 bg-white shadow-xs max-w-full">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs border-collapse" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-slate-100/90 text-slate-800 font-bold uppercase text-[10px] tracking-wider font-mono" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-slate-100 bg-white" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-blue-50/40 transition-colors" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-3.5 py-2.5 font-bold whitespace-nowrap text-slate-900 border-b border-slate-200" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3.5 py-2.5 text-slate-700 align-top leading-relaxed text-xs break-words" {...props} />
          ),
          h1: ({ node, ...props }) => (
            <h1 className="text-sm font-bold text-slate-900 mt-3.5 mb-2 border-b border-slate-100 pb-1" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xs font-bold text-slate-900 mt-3 mb-1.5" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-xs font-semibold text-slate-800 mt-2 mb-1" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="mb-2 last:mb-0 leading-relaxed text-slate-800" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-outside pl-4 space-y-1 mb-2.5 text-slate-800" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-outside pl-4 space-y-1 mb-2.5 text-slate-800" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-slate-900" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-3 border-blue-500 pl-3 py-1 my-2.5 text-slate-700 italic bg-blue-50/50 rounded-r-lg" {...props} />
          ),
          code: ({ node, className, children, ...props }) => {
            const isInline = !String(children).includes('\n');
            if (isInline) {
              return (
                <code className="bg-slate-100 text-blue-700 px-1.5 py-0.5 rounded text-[11px] font-mono border border-slate-200/80" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl overflow-x-auto text-[11px] font-mono my-2.5 shadow-xs">
                <code {...props}>{children}</code>
              </pre>
            );
          },
          hr: ({ node, ...props }) => (
            <hr className="border-slate-200 my-3" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && (
        <span className="inline-block w-2 h-3.5 bg-blue-600 ml-1 animate-pulse align-middle" />
      )}
    </div>
  );
};

/* ── Assistant Message Bubble ────────────────────────── */
const AssistantMessage: React.FC<{ msg: Message }> = ({ msg }) => {
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasSources = Boolean(msg.sources && msg.sources.length > 0);
  const isLong = Boolean(msg.content && msg.content.length > 500);

  const copyText = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="self-start max-w-[88%] space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-shadow">
        {/* Meta Header */}
        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-blue-600 font-mono">
            <Sparkles className="w-3 h-3 text-cyan-500" />
            AI Intelligence
          </span>
          {msg.intent && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 uppercase font-mono">
              {msg.intent}
            </span>
          )}
          {msg.confidence && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-mono ml-auto">
              Confidence: {msg.confidence}
            </span>
          )}
        </div>

        {/* Content */}
        <MarkdownRenderer content={msg.content} streaming={msg.streaming} />

        {/* Actions Bar */}
        <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center gap-2 flex-wrap text-slate-500 text-[11px]">
          <button
            onClick={copyText}
            className="flex items-center gap-1 hover:text-slate-900 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 font-medium"
          >
            {copied ? <><Check className="w-3 h-3 text-emerald-600" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
          </button>

          {hasSources && (
            <button
              onClick={() => setShowSources(s => !s)}
              className="flex items-center gap-1 hover:text-slate-900 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 font-medium text-blue-600"
            >
              {showSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {msg.sources?.length} source{msg.sources?.length !== 1 ? 's' : ''} cited
            </button>
          )}

          {isLong && (
            <>
              <button
                onClick={() => downloadTxt(msg.content, 'rag-intelligence-report.txt')}
                className="flex items-center gap-1 hover:text-slate-900 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 font-medium"
              >
                <Download className="w-3 h-3" /> .txt
              </button>
              <button
                onClick={() => downloadPdf(msg.content, 'rag-intelligence-report.pdf')}
                className="flex items-center gap-1 hover:text-slate-900 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 font-medium"
              >
                <Download className="w-3 h-3" /> .pdf
              </button>
            </>
          )}

          {(msg.mongoCount !== undefined || msg.vectorCount !== undefined) && (
            <span className="ml-auto text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              {msg.mongoCount ?? 0} DB · {msg.vectorCount ?? 0} VEC
            </span>
          )}
        </div>
      </div>

      {/* Sources Panel */}
      {showSources && hasSources && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs space-y-2 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
            Grounding Citations & Datasets
          </div>
          {msg.sources?.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-slate-600 text-[11px] bg-white p-2 rounded-lg border border-slate-200/60">
              <FileText className="w-3.5 h-3.5 shrink-0 text-blue-500 mt-0.5" />
              <span className="truncate flex-1">{typeof s === 'string' ? s : JSON.stringify(s)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── User Message Bubble ─────────────────────────────── */
const UserMessage: React.FC<{ msg: Message }> = ({ msg }) => {
  return (
    <div className="self-end max-w-[80%] space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-4 text-xs leading-relaxed whitespace-pre-wrap shadow-sm">
        {msg.content}
      </div>
      {msg.attachmentName && (
        <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-400 font-mono px-1">
          <Paperclip className="w-3 h-3" />
          <span>{msg.attachmentName}</span>
        </div>
      )}
    </div>
  );
};

/* ── Error Message Bubble ────────────────────────────── */
const ErrorMessage: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="self-start max-w-[85%]">
      <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 text-xs flex items-start gap-2 shadow-sm">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
        <span>{content}</span>
      </div>
    </div>
  );
};

/* ── Main RagChat Page ───────────────────────────────── */
export const RagChat: React.FC = () => {
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'assistant',
      content:
        'Hello. I am the PCIS RAG Intelligence AI Assistant.\n\nAsk me anything about your uploaded case datasets — pending cases, FIR counts, crime statistics by district, officer assignments, and more.\n\nResponses are grounded in your actual data with direct citations.',
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentState | null>(null);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const msgIdRef = useRef(1);

  useEffect(() => {
    const state = location.state as { prefill?: string } | null;
    if (state?.prefill) {
      setInput(state.prefill);
    }
  }, [location.state]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const handleAttachChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setAttachment({ file, uploading: true, done: false, error: null });

    const type = detectUploadType(file.name);
    const fd = new FormData();
    fd.append('file', file);

    try {
      await axios.post(`/api/v1/import/${type}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAttachment({ file, uploading: false, done: true, error: null });
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Upload failed.';
      setAttachment({ file, uploading: false, done: false, error: msg });
    }
  };

  const sendMessage = async (queryText?: string) => {
    const q = (queryText || input).trim();
    if (!q || loading) return;

    setInput('');
    const uid = msgIdRef.current++;
    const attachName = attachment?.file?.name || null;
    setMessages(prev => [...prev, { id: uid, role: 'user', content: q, attachmentName: attachName }]);
    setLoading(true);

    const aid = msgIdRef.current++;
    setMessages(prev => [...prev, { id: aid, role: 'assistant', content: '', streaming: true }]);

    try {
      const r = await axios.post('/api/v1/ai/chat', {
        query: q,
        session_id: sessionId,
      });

      const data = r.data;
      setMessages(prev =>
        prev.map(m =>
          m.id === aid
            ? {
                ...m,
                content: data.answer,
                streaming: false,
                intent: data.intent_detected,
                confidence: data.confidence,
                sources: data.sources || [],
                mongoCount: data.mongo_records_count,
                vectorCount: data.vector_docs_count,
              }
            : m
        )
      );
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message || 'Something went wrong while querying RAG AI.';
      setMessages(prev =>
        prev.map(m => (m.id === aid ? { ...m, content: errMsg, streaming: false, role: 'error' } : m))
      );
    } finally {
      setLoading(false);
      setAttachment(null);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = async () => {
    setMessages([
      {
        id: msgIdRef.current++,
        role: 'assistant',
        content: 'Conversation cleared. How can I help you?',
      },
    ]);
    try {
      await axios.delete(`/api/v1/ai/chat/${sessionId}`);
    } catch {
      /* ok */
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] max-w-5xl mx-auto space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-tr from-blue-600 to-cyan-500 text-white rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight font-heading">
                AI Intelligence Copilot
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-mono font-bold">
                GROQ RAG ONLINE
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Hybrid Neural Retrieval • MongoDB Complaints • 76 National Crime Datasets
            </p>
          </div>
        </div>

        <button
          onClick={clearChat}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-all shadow-xs"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Context
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-4 font-sans py-2">
        {messages.map(msg => {
          if (msg.role === 'user') return <UserMessage key={msg.id} msg={msg} />;
          if (msg.role === 'error') return <ErrorMessage key={msg.id} content={msg.content} />;
          return <AssistantMessage key={msg.id} msg={msg} />;
        })}

        {loading && (
          <div className="self-start">
            <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-2 text-xs text-slate-500 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
              <span>Querying vector database & case records...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick Queries Bar */}
      {messages.length <= 1 && (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-200 shrink-0">
          {QUICK_QUERIES.map(q => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={loading}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 transition-colors border border-slate-200"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Attachment Banner */}
      {attachment && (
        <div className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 truncate">
            <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-700 truncate">{attachment.file.name}</span>
            {attachment.uploading && <span className="text-slate-400 italic">— uploading...</span>}
            {attachment.done && <span className="text-emerald-600 font-bold">— uploaded ✓</span>}
            {attachment.error && <span className="text-rose-600 font-bold">— {attachment.error}</span>}
          </div>
          <button onClick={() => setAttachment(null)} className="p-1 hover:text-slate-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Box */}
      <div className="shrink-0 pt-2 border-t border-slate-200">
        <div className="flex items-end gap-2 bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm focus-within:border-slate-400 transition-colors">
          <button
            onClick={() => fileRef.current?.click()}
            title="Attach dataset file (.csv, .json, .xlsx)"
            className="p-2 hover:bg-slate-100 text-slate-500 rounded-xl transition-colors shrink-0"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_TYPES}
            onChange={handleAttachChange}
            className="hidden"
          />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about case records, pending FIRs, district stats... (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent border-none outline-none resize-none text-xs leading-relaxed text-slate-800 placeholder-slate-400 py-1 max-h-32"
          />

          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-1 font-mono">
          <span>Session: {sessionId}</span>
          <span>Shift+Enter for newline</span>
        </div>
      </div>
    </div>
  );
};
export default RagChat;
