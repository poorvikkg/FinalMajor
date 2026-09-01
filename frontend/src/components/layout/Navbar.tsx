import React, { useState } from 'react';
import { useAuthStore } from '../../store/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/Button';
import { Bell, LogOut, ShieldAlert, Check } from 'lucide-react';
import api from '../../api';

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: 'alert' | 'info' | 'warning' | 'success';
  isRead: boolean;
  createdAt: string;
}

export const Navbar: React.FC = () => {
  const { logout } = useAuthStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const queryClient = useQueryClient();

  // Fetch real notifications from the API, poll every 6 seconds
  const { data } = useQuery<{ notifications: NotificationItem[]; unreadCount: number }>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.data.data;
    },
    refetchInterval: 6000,
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Mutation to mark all notifications as read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.put('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mutation to mark single notification as read
  const readOneMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const getAlertStyle = (type: string) => {
    switch (type) {
      case 'alert':
        return 'text-red-700 font-black';
      case 'warning':
        return 'text-amber-800 font-bold';
      case 'success':
        return 'text-green-800';
      default:
        return 'text-slate-800';
    }
  };

  return (
    <header className="h-16 sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between shadow-xs">
      {/* Left Telemetry Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100/80 border border-slate-200/80 text-[11px] font-mono text-slate-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-slate-800">SYSTEM ACTIVE</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-normal">AI INFERENCE READY</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 relative transition-colors"
          >
            <Bell className="h-4.5 w-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-3.5 min-w-[14px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-lg z-20 overflow-hidden">
                <div className="px-4 py-3 bg-white border-b border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-800">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllReadMutation.mutate()}
                      className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
                    >
                      <Check className="h-3 w-3" /> Mark all read
                    </button>
                  )}
                </div>
                <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div
                        key={notif._id}
                        onClick={() => !notif.isRead && readOneMutation.mutate(notif._id)}
                        className={`p-3.5 transition-colors flex gap-2.5 text-xs cursor-pointer ${
                          notif.isRead ? 'opacity-60 bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100/70'
                        }`}
                      >
                        <ShieldAlert className={`h-4 w-4 shrink-0 mt-0.5 ${notif.isRead ? 'text-slate-400' : 'text-slate-700'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium ${getAlertStyle(notif.type)}`}>
                            {notif.title}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 break-words">
                            {notif.message.includes('Download: ') ? (
                              <>
                                {notif.message.split('Download: ')[0]}
                                <a 
                                  href={notif.message.split('Download: ')[1]} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-slate-800 underline font-medium ml-1"
                                >
                                  Download Report
                                </a>
                              </>
                            ) : (
                              notif.message
                            )}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(notif.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        {!notif.isRead && (
                          <div className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0 self-center" />
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No new notifications
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="h-4 w-px bg-slate-200" />
        
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 text-xs font-medium transition-colors hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
};
export default Navbar;
