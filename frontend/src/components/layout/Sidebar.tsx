import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import {
  Tv,
  ScanSearch,
  MapPin,
  Bot,
  Radio,
  Zap,
  Network,
  FilePlus,
  FileQuestion,
  FileText,
  UserSearch,
  Camera,
  Users,
  Database,
  Shield,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user } = useAuthStore();

  const sections = [
    {
      title: 'Operations',
      items: [
        { to: '/monitoring',    label: 'Live Monitoring',  icon: Tv,          roles: ['admin'] },
        { to: '/analyse',       label: 'Video Analysis',   icon: ScanSearch,   roles: ['admin'] },
        { to: '/detection-map', label: 'Detection Map',    icon: MapPin,       roles: ['admin', 'station'] },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        { to: '/suspects/chase-map',      label: 'Chase Map',          icon: Radio,   roles: ['admin'] },
        { to: '/analytics/threats',       label: 'Threat Board',       icon: Zap,     roles: ['admin'] },
        { to: '/analytics/accomplices',   label: 'Accomplice Engine',  icon: Network, roles: ['admin'] },
      ],
    },
    {
      title: 'RAG',
      items: [
        { to: '/rag/chat',   label: 'Chat',        icon: Bot,      roles: ['admin', 'station', 'viewer'] },
        { to: '/rag/import', label: 'Data Import', icon: Database, roles: ['admin', 'station'] },
      ],
    },
    {
      title: 'Cases',
      items: [
        { to: '/file-case',          label: 'File Complaint',    icon: FilePlus,   roles: ['station'] },
        { to: '/complaints',         label: 'View Complaints',   icon: FileQuestion, roles: ['admin', 'station'] },
        { to: '/logs',               label: 'Recognition Logs',  icon: FileText,   roles: ['admin'] },
        { to: '/recurring-unknowns', label: 'Recurring Unknowns',icon: UserSearch, roles: ['admin'] },
      ],
    },
    {
      title: 'Config',
      items: [
        { to: '/cameras', label: 'Camera Manager',  icon: Camera, roles: ['admin'] },
        { to: '/users',   label: 'Station Manager', icon: Users,  roles: ['admin'] },
      ],
    },
  ];

  return (
    <aside className="w-56 bg-white border-r border-slate-100 flex flex-col h-full select-none z-20 shrink-0">

      {/* Brand */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-slate-100 shrink-0">
        <div className="h-7 w-7 rounded-lg bg-slate-900 flex items-center justify-center text-white">
          <Shield className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="font-black text-slate-900 text-[13px] tracking-widest leading-none">SENTINEL</p>
          <p className="text-[8px] font-mono text-slate-400 tracking-widest uppercase mt-0.5">Law Enforcement</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-4">
        {sections.map((section) => {
          const visible = section.items.filter(
            (item) => user && item.roles.includes(user.role)
          );
          if (visible.length === 0) return null;

          return (
            <div key={section.title}>
              <p className="px-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {visible.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                        isActive
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}
                        />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-2.5 border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="h-7 w-7 rounded-lg bg-slate-900 flex items-center justify-center text-white text-[11px] font-black shrink-0">
            {(user?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-slate-900 truncate">{user?.name || 'User'}</p>
            <p className="text-[10px] text-slate-400 font-mono capitalize">{user?.role || 'Officer'}</p>
          </div>
        </div>
      </div>

    </aside>
  );
};

export default Sidebar;
