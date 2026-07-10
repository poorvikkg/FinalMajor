import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import {
  LayoutDashboard,
  Tv,
  Camera,
  FileText,
  AlertTriangle,
  FileQuestion,
  Users,
  Settings,
  Shield,
  FilePlus,
  ScanSearch,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user } = useAuthStore();
  
  const menuItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'operator'] },
    { to: '/monitoring', label: 'Live Monitoring', icon: Tv, roles: ['admin', 'operator'] },
    { to: '/analyse', label: 'Video Analysis', icon: ScanSearch, roles: ['admin', 'operator'] },
    { to: '/cameras', label: 'Camera Management', icon: Camera, roles: ['admin', 'operator'] },
    { to: '/logs', label: 'Recognition Logs', icon: FileText, roles: ['admin', 'operator'] },
    { to: '/unknown-faces', label: 'Unknown Faces', icon: AlertTriangle, roles: ['admin', 'operator'] },
    { to: '/file-case', label: 'File a Complaint', icon: FilePlus, roles: ['admin', 'operator', 'viewer'] },
    { to: '/complaints', label: 'My Complaints', icon: FileQuestion, roles: ['viewer'] },
    { to: '/complaints', label: 'Complaints & Tickets', icon: FileQuestion, roles: ['admin', 'operator'] },
    { to: '/users', label: 'User Management', icon: Users, roles: ['admin'] },
    { to: '/settings', label: 'System Settings', icon: Settings, roles: ['admin'] },
  ];

  const visibleItems = menuItems.filter((item) => user && item.roles.includes(user.role));

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col min-h-screen text-slate-700 select-none">
      {/* Title Header */}
      <div className="h-16 flex items-center gap-2 px-6 border-b border-slate-200 bg-slate-50">
        <Shield className="h-5 w-5 text-black shrink-0" />
        <span className="font-bold text-black tracking-wider text-xs uppercase">Sentinel AI System</span>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors duration-150 ${
                isActive
                  ? 'bg-black text-white'
                  : 'hover:bg-slate-100 hover:text-black text-slate-600'
              }`
            }
          >
            <item.icon className="h-4.5 w-4.5 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-3">
        <div className="h-8 w-8 rounded bg-black flex items-center justify-center text-white text-xs font-bold">
          {(user?.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-900 truncate leading-none mb-1">{user?.name || 'Loading...'}</p>
          <span className="text-[9px] uppercase font-extrabold text-slate-500 tracking-wider">
            {user?.role || '...'} CLEARANCE
          </span>
        </div>
      </div>
    </aside>
  );
};
export default Sidebar;
