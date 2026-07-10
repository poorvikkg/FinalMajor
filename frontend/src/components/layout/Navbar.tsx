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
    <header className="h-[72px] sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md px-8 flex items-center justify-between">
      {/* Spacer */}
      <div />

      {/* Right controls */}
      <div className="flex items-center gap-5">
        {/* Notifications */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 relative transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                {unreadCount}
              </span>
            )}
          </Button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl border border-slate-200 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] z-20 overflow-hidden transform origin-top-right transition-all">
                <div className="px-5 py-3.5 bg-slate-50/80 backdrop-blur-sm border-b border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-bold uppercase text-slate-800 tracking-wider font-heading">Alerts Queue</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllReadMutation.mutate()}
                      className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                    >
                      <Check className="h-3 w-3" /> Mark all read
                    </button>
                  )}
                </div>
                <div className="divide-y divide-slate-50 max-h-[320px] overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div
                        key={notif._id}
                        onClick={() => !notif.isRead && readOneMutation.mutate(notif._id)}
                        className={`p-4 transition-all flex gap-3 text-sm cursor-pointer ${
                          notif.isRead ? 'opacity-70 bg-white hover:bg-slate-50' : 'bg-indigo-50/30 hover:bg-indigo-50/60'
                        }`}
                      >
                        <ShieldAlert className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${notif.isRead ? 'text-slate-400' : 'text-indigo-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold tracking-wide ${getAlertStyle(notif.type)}`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 break-words leading-relaxed">
                            {notif.message.includes('Download: ') ? (
                              <>
                                {notif.message.split('Download: ')[0]}
                                <a 
                                  href={notif.message.split('Download: ')[1]} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-indigo-500 underline font-semibold ml-1"
                                >
                                  Download Report
                                </a>
                              </>
                            ) : (
                              notif.message
                            )}
                          </p>
                          <span className="text-[10px] font-medium text-slate-400 mt-2 block">
                            {new Date(notif.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        {!notif.isRead && (
                          <div className="h-2 w-2 rounded-full bg-indigo-500 shrink-0 self-center shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400 font-medium">
                      No new notifications
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile Info / Logout */}
        <div className="h-6 w-px bg-slate-200" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="flex items-center gap-2 text-slate-500 hover:text-rose-600 font-bold text-xs uppercase transition-colors rounded-xl"
        >
          <LogOut className="h-4.5 w-4.5" />
          <span>Sign Out</span>
        </Button>
      </div>
    </header>
  );
};
export default Navbar;
