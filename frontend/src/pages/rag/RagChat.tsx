import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { renderToStaticMarkup } from 'react-dom/server';
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
  Printer,
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
  query?: string;
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
  'Show pending cases',
  'List unsolved cases',
  'FIRs filed this month',
  'Crime stats by district',
  'Cases filed in 2024',
  'Arrested suspects',
];

const ACCEPT_TYPES = '.csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, .json';

function detectUploadType(filename: string): 'csv' | 'json' | 'excel' {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return 'csv';
  if (ext === 'json') return 'json';
  return 'excel';
}

function downloadTxt(msg: Message, filename = 'rag-report.txt') {
  const text = [
    '------------------------------------------------------------------------',
    '                              RAG REPORT                                ',
    '------------------------------------------------------------------------',
    `Date & Time : ${new Date().toLocaleString()}`,
    `Intent      : ${msg.intent || 'GENERAL'}`,
    `Confidence  : ${msg.confidence || 'N/A'}`,
    `Query       : ${msg.query || 'N/A'}`,
    `Grounding   : ${msg.mongoCount ?? 0} DB Records | ${msg.vectorCount ?? 0} Vector Documents`,
    '------------------------------------------------------------------------',
    '',
    msg.content,
    '',
    '------------------------------------------------------------------------',
    'Citations / Sources:',
    ...(msg.sources?.map(s => typeof s === 'string' ? `- ${s}` : `- ${JSON.stringify(s)}`) || ['- None']),
    '------------------------------------------------------------------------',
  ].join('\n');

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPdf(msg: Message, sessionId = '') {
  let renderedBodyHtml = '';
  try {
    renderedBodyHtml = renderToStaticMarkup(
      React.createElement(
        ReactMarkdown,
        { remarkPlugins: [remarkGfm] },
        msg.content
      )
    );
  } catch {
    renderedBodyHtml = `<pre style="white-space:pre-wrap; font-family:monospace;">${msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
  }

  const reportId = `RAG-${Date.now().toString(36).toUpperCase()}`;
  const genDate = new Date().toLocaleString();
  const intentBadge = msg.intent || 'QUERY';
  const confidence = (msg.confidence || 'HIGH').toUpperCase();

  const sourcesList = (msg.sources || []).map(s => {
    const text = typeof s === 'string' ? s : JSON.stringify(s);
    return `<li style="margin-bottom:3px; word-break:break-all;">${text}</li>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${reportId} - RAG Report</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 16mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.6;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    .report-container {
      max-width: 800px;
      margin: 0 auto;
    }

    /* ── Header ── */
    .report-header {
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .dept-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: -0.3px;
    }

    .dept-sub {
      font-size: 10.5px;
      font-weight: 500;
      color: #64748b;
      margin: 2px 0 0 0;
    }

    .meta-line {
      font-size: 9.5px;
      color: #475569;
      font-family: monospace;
      text-align: right;
    }

    /* ── Metadata Bar ── */
    .meta-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 6px 10px;
      margin-bottom: 12px;
      font-size: 10px;
    }

    .meta-label {
      font-size: 8.5px;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
      display: block;
    }

    .meta-val {
      font-weight: 600;
      color: #0f172a;
    }

    /* ── Query Box ── */
    .query-box {
      background: #f8fafc;
      border-left: 3px solid #0f172a;
      border-top: 1px solid #e2e8f0;
      border-right: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      padding: 8px 12px;
      margin-bottom: 14px;
      border-radius: 0 4px 4px 0;
    }

    .query-label {
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
    }

    .query-text {
      font-size: 11px;
      font-weight: 600;
      color: #0f172a;
    }

    /* ── Content Body ── */
    .content-body {
      font-size: 11px;
      line-height: 1.6;
    }

    .content-body h1, .content-body h2, .content-body h3 {
      color: #0f172a;
      font-weight: 700;
      margin-top: 12px;
      margin-bottom: 4px;
      page-break-after: avoid;
    }

    .content-body h1 {
      font-size: 13.5px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }

    .content-body h2 {
      font-size: 12.5px;
    }

    .content-body h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border-left: 2px solid #0f172a;
      padding-left: 6px;
    }

    .content-body p {
      margin: 0 0 6px 0;
    }

    .content-body ul, .content-body ol {
      margin: 0 0 8px 0;
      padding-left: 18px;
    }

    .content-body li {
      margin-bottom: 2px;
    }

    .content-body strong {
      font-weight: 600;
      color: #0f172a;
    }

    .content-body blockquote {
      border-left: 2.5px solid #94a3b8;
      background: #f8fafc;
      margin: 6px 0;
      padding: 4px 10px;
      color: #475569;
    }

    /* ── Structured Tables ── */
    .content-body table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 10px 0 12px 0 !important;
      font-size: 10px !important;
      page-break-inside: avoid;
      background: #ffffff;
      border: 1px solid #cbd5e1;
    }

    .content-body thead {
      display: table-header-group;
      background-color: #0f172a !important;
      color: #ffffff !important;
    }

    .content-body th {
      background-color: #0f172a !important;
      color: #ffffff !important;
      font-weight: 600 !important;
      text-transform: uppercase !important;
      font-size: 9px !important;
      padding: 6px 8px !important;
      border: 1px solid #334155 !important;
      text-align: left !important;
      white-space: nowrap !important;
    }

    .content-body td {
      padding: 5px 8px !important;
      border: 1px solid #e2e8f0 !important;
      color: #1e293b !important;
      vertical-align: top !important;
      word-break: break-word !important;
    }

    .content-body tbody tr:nth-child(even) {
      background-color: #f8fafc !important;
    }

    /* ── Sources ── */
    .sources-box {
      margin-top: 14px;
      padding: 8px 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      page-break-inside: avoid;
      font-size: 9.5px;
    }

    .sources-title {
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8.5px;
      color: #64748b;
      margin-bottom: 4px;
    }

    .sources-list {
      margin: 0;
      padding-left: 14px;
      color: #475569;
    }

    /* ── Footer ── */
    .report-footer {
      margin-top: 16px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: #94a3b8;
      font-family: monospace;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="report-header">
      <div>
        <h1 class="dept-title">RAG Intelligence Report</h1>
        <p class="dept-sub">Police Case Intelligence System</p>
      </div>
      <div class="meta-line">
        ID: ${reportId}<br>
        ${genDate}
      </div>
    </div>

    <div class="meta-bar">
      <div>
        <span class="meta-label">Intent</span>
        <span class="meta-val">${intentBadge}</span>
      </div>
      <div>
        <span class="meta-label">Confidence</span>
        <span class="meta-val">${confidence}</span>
      </div>
      <div>
        <span class="meta-label">Database Grounding</span>
        <span class="meta-val">${msg.mongoCount ?? 0} DB · ${msg.vectorCount ?? 0} VEC</span>
      </div>
      <div>
        <span class="meta-label">Report ID</span>
        <span class="meta-val">${reportId}</span>
      </div>
    </div>

    ${msg.query ? `
    <div class="query-box">
      <div class="query-label">Query:</div>
      <div class="query-text">${msg.query.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>
    ` : ''}

    <div class="content-body">
      ${renderedBodyHtml}
    </div>

    ${sourcesList ? `
    <div class="sources-box">
      <div class="sources-title">Citations / Datasets:</div>
      <ul class="sources-list">
        ${sourcesList}
      </ul>
    </div>
    ` : ''}

    <div class="report-footer">
      <span>PCIS RAG REPORT • ${reportId}</span>
      <span>CONFIDENTIAL - POLICE USE ONLY</span>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      setTimeout(() => {
        win.print();
        URL.revokeObjectURL(url);
      }, 200);
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
            <div className="overflow-x-auto my-3 rounded-lg border border-slate-200 bg-white max-w-full">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs border-collapse" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-slate-900 text-white font-medium uppercase text-[10px] tracking-wider font-mono" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-slate-100 bg-white" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-slate-50 even:bg-slate-50/50 transition-colors" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 font-semibold whitespace-nowrap text-white border-b border-slate-800" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 text-slate-700 align-top leading-relaxed text-xs border-b border-slate-100 break-words" {...props} />
          ),
          h1: ({ node, ...props }) => (
            <h1 className="text-sm font-bold text-slate-900 mt-3.5 mb-1.5 border-b border-slate-200 pb-1" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xs font-bold text-slate-900 mt-3 mb-1" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-xs font-semibold text-slate-900 mt-2.5 mb-1 border-l-2 border-slate-800 pl-2 uppercase tracking-wide" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="mb-2 last:mb-0 leading-relaxed text-slate-800" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-outside pl-4 space-y-1 mb-2 text-slate-800" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-outside pl-4 space-y-1 mb-2 text-slate-800" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-slate-900" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-2 border-slate-400 pl-2.5 py-1 my-2 text-slate-600 bg-slate-50 rounded-r" {...props} />
          ),
          code: ({ node, className, children, ...props }) => {
            const isInline = !String(children).includes('\n');
            if (isInline) {
              return (
                <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-[11px] font-mono border border-slate-200" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-lg overflow-x-auto text-[11px] font-mono my-2">
                <code {...props}>{children}</code>
              </pre>
            );
          },
          hr: ({ node, ...props }) => (
            <hr className="border-slate-200 my-2.5" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && (
        <span className="inline-block w-1.5 h-3 bg-slate-700 ml-1 animate-pulse align-middle" />
      )}
    </div>
  );
};

/* ── Assistant Message Bubble ────────────────────────── */
const AssistantMessage: React.FC<{ msg: Message; sessionId?: string }> = ({ msg, sessionId }) => {
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasSources = Boolean(msg.sources && msg.sources.length > 0);
  const hasContent = Boolean(msg.content && msg.content.trim().length > 0);

  const copyText = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="self-start max-w-[90%] space-y-1">
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
        {/* Meta Header */}
        <div className="flex items-center gap-2 mb-2 flex-wrap text-slate-600">
          <span className="text-[11px] font-bold tracking-wide uppercase font-mono text-slate-800">
            RAG
          </span>
          {msg.intent && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase font-mono">
              {msg.intent}
            </span>
          )}
          {msg.confidence && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono ml-auto">
              Confidence: {msg.confidence}
            </span>
          )}
        </div>

        {/* Content */}
        <MarkdownRenderer content={msg.content} streaming={msg.streaming} />

        {/* Actions Bar */}
        {hasContent && !msg.streaming && (
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap text-slate-500 text-[11px]">
            <button
              onClick={copyText}
              className="flex items-center gap-1 hover:text-slate-900 transition-colors px-2 py-1 rounded hover:bg-slate-100 font-medium"
              title="Copy text"
            >
              {copied ? <><Check className="w-3 h-3 text-emerald-600" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>

            {hasSources && (
              <button
                onClick={() => setShowSources(s => !s)}
                className="flex items-center gap-1 hover:text-slate-900 transition-colors px-2 py-1 rounded hover:bg-slate-100 font-medium"
              >
                {showSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {msg.sources?.length} source{msg.sources?.length !== 1 ? 's' : ''}
              </button>
            )}

            <button
              onClick={() => downloadTxt(msg, `rag-report-${msg.id}.txt`)}
              className="flex items-center gap-1 hover:text-slate-900 transition-colors px-2 py-1 rounded hover:bg-slate-100 font-medium"
              title="Download TXT"
            >
              <Download className="w-3 h-3" /> .txt
            </button>

            <button
              onClick={() => downloadPdf(msg, sessionId)}
              className="flex items-center gap-1 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors px-2 py-1 rounded font-medium"
              title="Download PDF"
            >
              <Printer className="w-3 h-3" /> PDF
            </button>

            {(msg.mongoCount !== undefined || msg.vectorCount !== undefined) && (
              <span className="ml-auto text-[10px] font-mono text-slate-400">
                {msg.mongoCount ?? 0} DB · {msg.vectorCount ?? 0} VEC
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sources Panel */}
      {showSources && hasSources && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs space-y-1.5">
          <div className="text-[10px] font-semibold uppercase text-slate-500 font-mono">
            Sources & Datasets
          </div>
          {msg.sources?.map((s, i) => (
            <div key={i} className="flex items-start gap-1.5 text-slate-600 text-[11px] bg-white p-1.5 rounded border border-slate-200">
              <FileText className="w-3 h-3 shrink-0 text-slate-500 mt-0.5" />
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
    <div className="self-end max-w-[80%] space-y-1">
      <div className="bg-slate-900 text-white rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap">
        {msg.content}
      </div>
      {msg.attachmentName && (
        <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono px-1">
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
      <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
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
        'Ask any questions about cases, FIR records, suspects, or district statistics.',
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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
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
    setMessages(prev => [...prev, { id: aid, role: 'assistant', content: '', query: q, streaming: true }]);

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
                query: q,
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
      const errMsg = err.response?.data?.detail || err.message || 'Something went wrong while querying RAG.';
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
        content: 'Conversation cleared.',
      },
    ]);
    try {
      await axios.delete(`/api/v1/ai/chat/${sessionId}`);
    } catch {
      /* ok */
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] max-w-4xl mx-auto space-y-3">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 bg-slate-900 text-white rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900">
                RAG
              </h1>
              <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Online
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={clearChat}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-3 font-sans py-1">
        {messages.map(msg => {
          if (msg.role === 'user') return <UserMessage key={msg.id} msg={msg} />;
          if (msg.role === 'error') return <ErrorMessage key={msg.id} content={msg.content} />;
          return <AssistantMessage key={msg.id} msg={msg} sessionId={sessionId} />;
        })}

        {loading && (
          <div className="self-start">
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-700" />
              <span>Querying database...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick Queries Bar */}
      {messages.length <= 1 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 shrink-0">
          {QUICK_QUERIES.map(q => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={loading}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Attachment Banner */}
      {attachment && (
        <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 truncate">
            <Paperclip className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="font-medium text-slate-700 truncate">{attachment.file.name}</span>
            {attachment.uploading && <span className="text-slate-400 italic">— uploading...</span>}
            {attachment.done && <span className="text-emerald-600 font-medium">— uploaded</span>}
            {attachment.error && <span className="text-rose-600 font-medium">— {attachment.error}</span>}
          </div>
          <button onClick={() => setAttachment(null)} className="p-0.5 hover:text-slate-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Box */}
      <div className="shrink-0 pt-1 border-t border-slate-200">
        <div className="flex items-end gap-2 bg-white border border-slate-200 rounded-xl p-2 focus-within:border-slate-400 transition-colors">
          <button
            onClick={() => fileRef.current?.click()}
            title="Attach dataset (.csv, .json, .xlsx)"
            className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors shrink-0"
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
            placeholder="Ask a question..."
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent border-none outline-none resize-none text-xs leading-relaxed text-slate-800 placeholder-slate-400 py-1 max-h-28"
          />

          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-all shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default RagChat;
