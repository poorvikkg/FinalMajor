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
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between">
      {/* Title */}
      <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">
        Official Surveillance Control Console
      </h2>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded hover:bg-slate-100 text-slate-800 relative"
          >
            <Bell className="h-4.5 w-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-3.5 min-w-[14px] px-1 rounded-full bg-black text-white text-[8px] font-mono font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </Button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 mt-2 w-80 bg-white rounded border border-slate-300 shadow-lg z-20 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-bold uppercase text-slate-900 tracking-wider">Alerts Queue</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllReadMutation.mutate()}
                      className="text-[9px] font-black uppercase text-slate-500 hover:text-black underline flex items-center gap-1"
                    >
                      <Check className="h-2.5 w-2.5" /> Mark all read
                    </button>
                  )}
                </div>
                <div className="divide-y divide-slate-150 max-h-64 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div
                        key={notif._id}
                        onClick={() => !notif.isRead && readOneMutation.mutate(notif._id)}
                        className={`p-3 transition-colors flex gap-2.5 text-xs cursor-pointer ${
                          notif.isRead ? 'opacity-60 bg-white hover:bg-slate-50' : 'bg-slate-50 font-semibold hover:bg-slate-100'
                        }`}
                      >
                        <ShieldAlert className="h-4 w-4 text-black shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] truncate uppercase tracking-wide ${getAlertStyle(notif.type)}`}>
                            {notif.title}
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5 break-words leading-tight">{notif.message}</p>
                          <span className="text-[9px] text-slate-400 mt-1 block font-mono">
                            {new Date(notif.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        {!notif.isRead && (
                          <div className="h-1.5 w-1.5 rounded-full bg-black shrink-0 self-center" />
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-[10px] text-slate-400 uppercase tracking-widest">
                      No notifications
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile Info / Logout */}
        <div className="h-5 w-px bg-slate-200" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="flex items-center gap-2 text-slate-700 hover:text-black font-semibold text-xs uppercase"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </Button>
      </div>
    </header>
  );
};
export default Navbar;
