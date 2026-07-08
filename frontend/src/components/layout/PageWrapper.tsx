import React from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

interface PageWrapperProps {
  children: React.ReactNode;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-dark-950 transition-colors duration-200">
      {/* Sidebar Panel (fixed left) */}
      <Sidebar />

      {/* Main Panel Content (scrollable right) */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-[1600px] mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};
