import React from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot } from 'lucide-react';

interface PageWrapperProps {
  children: React.ReactNode;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Full-screen pages that should not have page padding or max-width limits
  const isFullScreenPage = [
    '/suspects/chase-map',
    '/zones',
    '/monitoring',
    '/detection-map'
  ].includes(location.pathname);

  // Hide FAB on rag pages (user is already there)
  const isRagPage = location.pathname.startsWith('/rag');

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-dark-950 transition-colors duration-200">
      {/* Sidebar Panel (fixed left) */}
      <Sidebar />

      {/* Main Panel Content (scrollable right) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Navbar />
        <main
          className={`flex-1 w-full ${
            isFullScreenPage
              ? 'p-0 overflow-hidden'
              : 'p-6 md:p-8 overflow-y-auto max-w-[1600px] mx-auto'
          }`}
        >
          {children}
        </main>
      </div>

      {/* ── Floating RAG Chatbot FAB Button ──────────────── */}
      {!isRagPage && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 group">
          {/* Main FAB button */}
          <div className="relative">
            {/* Pulse ring animation */}
            <span className="absolute inset-0 rounded-full animate-ping bg-blue-600 opacity-20" />
            <button
              onClick={() => navigate('/rag/chat')}
              title="RAG AI Intelligence Assistant"
              className="relative flex items-center justify-center w-14 h-14 rounded-full shadow-2xl
                transition-all duration-300 hover:scale-110 active:scale-95 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Bot className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Tooltip label */}
          <div className="absolute bottom-16 right-0 bg-slate-900 text-white text-[10px] font-bold 
            px-2.5 py-1 rounded-lg whitespace-nowrap pointer-events-none opacity-0 
            group-hover:opacity-100 transition-opacity duration-200 shadow-lg">
            RAG Intelligence
          </div>
        </div>
      )}
    </div>
  );
};

