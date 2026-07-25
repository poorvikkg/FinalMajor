import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { CameraMap } from '../../components/map/CameraMap';
import { LocationPicker } from '../../components/map/LocationPicker';
import { Camera, Plus, Trash2, Map, List } from 'lucide-react';
import api from '../../api';

interface CameraItem {
  _id: string;
  name: string;
  location: { name: string; latitude: number; longitude: number } | string;
  type: 'ip' | 'rtsp' | 'usb' | 'cloud';
  status: 'online' | 'offline' | 'maintenance';
  rtspUrl?: string;
}

export const CameraManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [locationObj, setLocationObj] = useState<{ name: string; latitude: number; longitude: number }>({
    name: '',
    latitude: 12.9141,
    longitude: 74.856,
  });
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
    mutationFn: async (data: any) => {
      await api.post('/cameras', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camerasList'] });
      setIsAddOpen(false);
      setName('');
      setLocationObj({ name: '', latitude: 12.9141, longitude: 74.856 });
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
    addMutation.mutate({
      name,
      location: locationObj,
      type,
      rtspUrl: type === 'rtsp' ? rtspUrl : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Camera Network Stations</h1>
          <p className="text-xs text-slate-500 font-medium">Add, configure, and inspect connected CCTV streams and map locations.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded text-xs font-bold transition-colors ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`p-1.5 rounded text-xs font-bold transition-colors ${
                viewMode === 'map' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              <Map className="h-4 w-4" />
            </button>
          </div>

          <Button onClick={() => setIsAddOpen(true)} className="flex items-center gap-2 text-xs font-bold bg-slate-900">
            <Plus className="h-4 w-4" /> Add Camera Station
          </Button>
        </div>
      </div>

      {viewMode === 'map' ? (
        <Card className="border-slate-200">
          <CardContent className="p-0">
            <CameraMap cameras={cameras as any[] || []} height="560px" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
                    <th className="px-6 py-4.5">Station Details</th>
                    <th className="px-6 py-4.5">Stream Type</th>
                    <th className="px-6 py-4.5">Status Check</th>
                    <th className="px-6 py-4.5">Network Feed URL</th>
                    <th className="px-6 py-4.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-xs text-slate-450">Loading cameras...</td>
                    </tr>
                  ) : cameras && cameras.length > 0 ? (
                    cameras.map((cam) => {
                      const locName = typeof cam.location === 'object' ? cam.location.name : cam.location;
                      return (
                        <tr key={cam._id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4.5 flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg">
                              <Camera className="h-5 w-5 text-slate-500" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{cam.name}</p>
                              <p className="text-xs text-slate-500">{locName || 'No location set'}</p>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5 hover:bg-red-50 hover:text-red-500"
                              onClick={() => deleteMutation.mutate(cam._id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
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
      )}

      {/* Add Camera Modal with Map Picker */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Register Camera Station">
        <form onSubmit={handleAddSubmit} className="space-y-4 select-none">
          <Input
            label="Camera Name"
            placeholder="Main Gate Lobby"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Physical Location & Map Marker
            </label>
            <LocationPicker
              locationName={locationObj.name}
              latitude={locationObj.latitude}
              longitude={locationObj.longitude}
              onChange={(data) => setLocationObj(data)}
              height="240px"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Connection Protocol Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white font-semibold"
            >
              <option value="rtsp">RTSP Stream Protocol</option>
              <option value="ip">IP Camera Feed</option>
              <option value="usb">Direct USB Feed</option>
              <option value="cloud">Cloud Network Stream</option>
            </select>
          </div>

          {type === 'rtsp' && (
            <Input
              label="RTSP Network URL"
              placeholder="rtsp://admin:pass@192.168.1.100:554/stream"
              value={rtspUrl}
              onChange={(e) => setRtspUrl(e.target.value)}
              required
            />
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addMutation.isPending} className="bg-slate-900 text-white font-bold">
              {addMutation.isPending ? 'Saving...' : 'Add Camera Station'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default CameraManagement;
