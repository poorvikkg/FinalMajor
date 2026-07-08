import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Camera, Plus, Edit2, Trash2 } from 'lucide-react';
import api from '../../api';

interface CameraItem {
  _id: string;
  name: string;
  location: string;
  type: 'ip' | 'rtsp' | 'usb' | 'cloud';
  status: 'online' | 'offline' | 'maintenance';
  rtspUrl?: string;
}

export const CameraManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<'ip' | 'rtsp' | 'usb' | 'cloud'>('rtsp');
  const [rtspUrl, setRtspUrl] = useState('');

  // Fetch cameras list
  const { data: cameras, isLoading } = useQuery<CameraItem[]>({
    queryKey: ['camerasList'],
    queryFn: async () => {
      try {
        const response = await api.get('/cameras?limit=50');
        return response.data.data;
      } catch {
        return [] as CameraItem[];
      }
    }
  });

  // Add camera mutation
  const addMutation = useMutation({
    mutationFn: async (data: Partial<CameraItem>) => {
      await api.post('/cameras', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camerasList'] });
      setIsAddOpen(false);
      setName('');
      setLocation('');
      setRtspUrl('');
    }
  });

  // Delete camera mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/cameras/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camerasList'] });
    }
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate({ name, location, type, rtspUrl: type === 'rtsp' ? rtspUrl : undefined });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Camera Network Stations</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Add, configure, and inspect all connected surveillance IP / RTSP feeds.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4.5 w-4.5" /> Add Camera Station
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-dark-900 text-xs font-semibold text-slate-500 uppercase border-b border-slate-150 dark:border-dark-800">
                  <th className="px-6 py-4.5">Station Details</th>
                  <th className="px-6 py-4.5">Stream Type</th>
                  <th className="px-6 py-4.5">Status Check</th>
                  <th className="px-6 py-4.5">Network Feed URL</th>
                  <th className="px-6 py-4.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-800 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-xs text-slate-450">Loading cameras...</td>
                  </tr>
                ) : cameras && cameras.length > 0 ? (
                  cameras.map((cam) => (
                    <tr key={cam._id} className="hover:bg-slate-50/50 dark:hover:bg-dark-900/10">
                      <td className="px-6 py-4.5 flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-dark-900 rounded-lg">
                          <Camera className="h-5 w-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{cam.name}</p>
                          <p className="text-xs text-slate-450">{cam.location}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4.5">
                        <Badge variant="primary">{cam.type.toUpperCase()}</Badge>
                      </td>
                      <td className="px-6 py-4.5">
                        <Badge variant={cam.status === 'online' ? 'success' : cam.status === 'offline' ? 'danger' : 'warning'}>
                          {cam.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-6 py-4.5 font-mono text-xs text-slate-450 max-w-xs truncate">
                        {cam.rtspUrl || 'IP Network Feed'}
                      </td>
                      <td className="px-6 py-4.5 text-right space-x-2">
                        <Button variant="ghost" size="sm" className="p-1.5 hover:bg-slate-100 dark:hover:bg-dark-800">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1.5 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                          onClick={() => deleteMutation.mutate(cam._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-xs text-slate-450">No cameras configured.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Camera Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Register Camera Station">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <Input
            label="Camera Name"
            placeholder="Main Gate Lobby"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Location/Block"
            placeholder="Gate A Lobby entrance"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />

          <div>
            <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">
              Connection Protocol Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-350 dark:border-dark-750 bg-white dark:bg-dark-800 text-slate-900 dark:text-slate-100"
            >
              <option value="rtsp">RTSP Stream Protocol</option>
              <option value="ip">Direct IP Address</option>
              <option value="usb">Integrated USB Hardware</option>
              <option value="cloud">Cloud Stream Endpoint</option>
            </select>
          </div>

          {type === 'rtsp' && (
            <Input
              label="RTSP URL Endpoint"
              placeholder="rtsp://admin:pass@192.168.1.100:554/stream1"
              value={rtspUrl}
              onChange={(e) => setRtspUrl(e.target.value)}
              required
            />
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={addMutation.isPending}>Add Station</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default CameraManagement;
