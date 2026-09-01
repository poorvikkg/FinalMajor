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
  FilePlus,
  UserSearch,
  MapPin,
  Radio,
  Zap,
  Network,
  Layers,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user } = useAuthStore();

  const sections = [
    {
      title: 'Operations',
      items: [
        { to: '/', label: 'Command Center', icon: LayoutDashboard, roles: ['admin'] },
        { to: '/monitoring', label: 'Live Monitoring', icon: Tv, roles: ['admin'] },
        { to: '/analyse', label: 'Video Analysis', icon: ScanSearch, roles: ['admin'] },
        { to: '/detection-map', label: 'Detection Map', icon: MapPin, roles: ['admin', 'station'] },
      ]
    },
    {
      title: 'Intelligence',
      items: [
        { to: '/suspects/chase-map', label: 'Chase Map', icon: Radio, roles: ['admin'] },
        { to: '/analytics/threats', label: 'Threat Board', icon: Zap, roles: ['admin'] },
        { to: '/analytics/accomplices', label: 'Accomplice Engine', icon: Network, roles: ['admin'] },
        { to: '/zones', label: 'Geofence Zones', icon: Layers, roles: ['admin'] },
      ]
    },
    {
      title: 'Cases & Records',
      items: [
        { to: '/file-case', label: 'File Complaint', icon: FilePlus, roles: ['admin', 'station'] },
        { to: '/complaints', label: 'View Complaints', icon: FileQuestion, roles: ['admin', 'station'] },
        { to: '/logs', label: 'Recognition Logs', icon: FileText, roles: ['admin'] },
        { to: '/recurring-unknowns', label: 'Recurring Unknowns', icon: UserSearch, roles: ['admin'] },
      ]
    },
    {
      title: 'Configuration',
      items: [
        { to: '/cameras', label: 'Camera Manager', icon: Camera, roles: ['admin'] },
        { to: '/users', label: 'Station Manager', icon: Users, roles: ['admin'] },
      ]
    }
  ];

  return (
    <aside className="w-60 bg-white border-r border-slate-200/80 flex flex-col min-h-screen text-slate-700 select-none">
      {/* Title Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100">
        <h1 className="font-bold text-slate-900 tracking-wider text-sm font-heading">SENTINEL</h1>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {sections.map((section) => {
          const visibleSectionItems = section.items.filter(
            (item) => user && item.roles.includes(user.role)
          );
          if (visibleSectionItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-0.5">
              <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {visibleSectionItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'text-slate-900 bg-slate-100 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}`} />
                        <span>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Profile Area */}
      <div className="p-3 m-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center text-white text-xs font-semibold">
          {(user?.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-900 truncate">{user?.name || 'User'}</p>
          <p className="text-[10px] text-slate-500 capitalize">{user?.role || ''}</p>
        </div>
      </div>
    </aside>
  );
};
export default Sidebar;
