import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import {
  LayoutDashboard,
  Tv,
  Camera,
  FileText,
  FileQuestion,
  Users,
  ScanSearch,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user } = useAuthStore();

  const menuItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'station'] },
    { to: '/monitoring', label: 'Live Monitoring', icon: Tv, roles: ['admin', 'station'] },
    { to: '/analyse', label: 'Video Analysis', icon: ScanSearch, roles: ['admin', 'station'] },
    { to: '/cameras', label: 'Camera Management', icon: Camera, roles: ['admin', 'station'] },
    { to: '/logs', label: 'Recognition Logs', icon: FileText, roles: ['admin', 'station'] },
    { to: '/complaints', label: 'Complaints', icon: FileQuestion, roles: ['admin', 'station'] },
    { to: '/users', label: 'Station Management', icon: Users, roles: ['admin'] },
  ];

  const visibleItems = menuItems.filter((item) => user && item.roles.includes(user.role));

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col min-h-screen text-slate-700 select-none relative overflow-hidden">
      {/* Title Header */}
      <div className="h-[72px] flex items-center px-6 border-b border-slate-200 bg-slate-50 relative z-10">
        <div>
          <h1 className="font-black text-slate-900 tracking-widest text-[13px] uppercase font-heading">MPDS</h1>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 relative z-10 overflow-y-auto overflow-x-hidden">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 group relative overflow-hidden ${
                isActive
                  ? 'text-white bg-slate-900 shadow-md shadow-slate-900/10'
                  : 'hover:text-slate-900 text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-white rounded-r-full opacity-50" />
                )}
                
                <item.icon className={`h-4.5 w-4.5 shrink-0 relative z-10 transition-colors duration-200 ${isActive ? 'text-white' : 'group-hover:text-slate-900'}`} />
                <span className="relative z-10">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Profile Area */}
      <div className="p-4 m-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center gap-3 relative z-10 hover:bg-slate-100 transition-colors cursor-pointer group shadow-sm">
        <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-sm font-black shadow-sm">
          {(user?.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-900 truncate mb-0.5">{user?.name || 'Loading...'}</p>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
              {user?.role || '...'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
export default Sidebar;
