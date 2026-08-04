import React from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useLocation } from 'react-router-dom';

interface PageWrapperProps {
  children: React.ReactNode;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({ children }) => {
  const location = useLocation();

  // Full-screen pages that should not have page padding or max-width limits
  const isFullScreenPage = [
    '/suspects/chase-map',
    '/zones',
    '/monitoring',
    '/map'
  ].includes(location.pathname);

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
    </div>
  );
};
