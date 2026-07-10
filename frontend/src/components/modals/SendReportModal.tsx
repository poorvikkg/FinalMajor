import { useEffect, useState } from 'react';
import api from '../../api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface Station {
  _id: string;
  name: string;
  email: string;
}

interface SendReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  logId: string;
  personName: string;
}

export function SendReportModal({ isOpen, onClose, logId, personName }: SendReportModalProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
      setSelectedStation('');
      // Fetch stations
      api.get('/users?role=station')
        .then((res: any) => {
          setStations(res.data.data || []);
          if (res.data.data?.length > 0) {
            setSelectedStation(res.data.data[0]._id);
          }
        })
        .catch(() => {
          setError('Failed to load police stations');
        });
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!selectedStation) {
      setError('Please select a station');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post('/reports/send', {
        logId,
        stationId: selectedStation
      });
      setSuccess('Report sent successfully!');
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Send Report for ${personName}`}>
      <div className="space-y-4 p-4">
        <p className="text-sm text-slate-600">
          Generate a PDF report including missing person details and detection evidence, and send it directly to a police station.
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 p-2 text-sm border border-red-200">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-emerald-50 text-emerald-700 p-2 text-sm border border-emerald-200">
            {success}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
            Select Police Station
          </label>
          <select 
            className="w-full border border-slate-300 p-2 text-sm focus:outline-none focus:border-slate-900"
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            disabled={loading || stations.length === 0}
          >
            {stations.length === 0 && <option value="">No stations available</option>}
            {stations.map(s => (
              <option key={s._id} value={s._id}>{s.name} ({s.email})</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSend} isLoading={loading} disabled={stations.length === 0}>
            Send Report
          </Button>
        </div>
      </div>
    </Modal>
  );
}
