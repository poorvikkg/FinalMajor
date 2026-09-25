import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

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

  // Close panel when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifications]);

  const markAllReadMutation = useMutation({
    mutationFn: async () => { await api.put('/notifications/read-all'); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const readOneMutation = useMutation({
    mutationFn: async (id: string) => { await api.put(`/notifications/${id}/read`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const typeColor = (type: string) => {
    if (type === 'alert') return 'text-red-600 font-semibold';
    if (type === 'warning') return 'text-amber-600 font-semibold';
    if (type === 'success') return 'text-emerald-700 font-semibold';
    return 'text-slate-800';
  };

  return (
    <header className="h-14 shrink-0 border-b border-slate-100 bg-white px-5 flex items-center justify-end gap-3 z-30">

      {/* Notification Bell */}
      <div className="relative" ref={panelRef}>
        <button
          type="button"
          onClick={() => setShowNotifications((s) => !s)}
          className="relative p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>

        {showNotifications && (
          <div className="absolute right-0 top-full mt-1.5 w-76 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-slate-900">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllReadMutation.mutate()}
                  className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
                >
                  <Check className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>

            {/* Items */}
            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-50">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div
                    key={notif._id}
                    onClick={() => !notif.isRead && readOneMutation.mutate(notif._id)}
                    className={`px-4 py-3 flex gap-3 text-xs cursor-pointer transition-colors ${
                      notif.isRead ? 'hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100/60'
                    }`}
                  >
                    <ShieldAlert className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${notif.isRead ? 'text-slate-300' : 'text-slate-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] leading-tight ${typeColor(notif.type)}`}>{notif.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 break-words leading-relaxed">
                        {notif.message.includes('Download: ') ? (
                          <>
                            {notif.message.split('Download: ')[0]}
                            <a
                              href={notif.message.split('Download: ')[1]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-700 underline font-medium ml-1"
                            >
                              Download Report
                            </a>
                          </>
                        ) : notif.message}
                      </p>
                      <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                        {new Date(notif.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    {!notif.isRead && (
                      <div className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0 self-start mt-1" />
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-[12px] text-slate-400">
                  No notifications
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-slate-200" />

      {/* Sign out */}
      <button
        type="button"
        onClick={logout}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 text-[12px] font-medium transition-colors"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>

    </header>
  );
};

export default Navbar;
