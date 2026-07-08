import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/auth';
import api from '../../api';

interface PhotoAttachment {
  file: File;
  preview: string;
}

export const FileCase: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [filerName, setFilerName] = useState(user?.name || '');
  const [filerEmail, setFilerEmail] = useState(user?.email || '');
  const [filerPhone, setFilerPhone] = useState('');
  const [filerAddress, setFilerAddress] = useState('');

  const [suspectName, setSuspectName] = useState('');
  const [suspectAge, setSuspectAge] = useState('');
  const [suspectGender, setSuspectGender] = useState('');
  const [suspectDescription, setSuspectDescription] = useState('');

  // Suspect photos list (multiple)
  const [photos, setPhotos] = useState<PhotoAttachment[]>([]);

  const [incidentType, setIncidentType] = useState('unauthorized_access');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
  const [incidentLocation, setIncidentLocation] = useState('');
  const [cameraStation, setCameraStation] = useState('');
  const [incidentDetails, setIncidentDetails] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('high');

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      selectedFiles.forEach((file) => {
        if (!file.type.startsWith('image/')) {
          setSubmitError('Only image files are allowed as suspect photo attachments.');
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          setSubmitError('Each photo must be under 10 MB.');
          return;
        }
        setSubmitError(null);
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPhotos((prev) => [
            ...prev,
            { file, preview: ev.target?.result as string },
          ]);
        };
        reader.readAsDataURL(file);
      });
      // Clear target value so same files can be selected again
      e.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const fileCaseMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('name', filerName);
      formData.append('email', filerEmail);
      formData.append('phone', filerPhone);
      const fullDescription = [
        `FILER ADDRESS: ${filerAddress}`,
        `SUSPECT NAME: ${suspectName || 'Unknown'}`,
        `SUSPECT AGE: ${suspectAge || 'Unknown'}`,
        `SUSPECT GENDER: ${suspectGender || 'Unknown'}`,
        `SUSPECT DESCRIPTION: ${suspectDescription}`,
        `INCIDENT LOCATION: ${incidentLocation}`,
        `CAMERA STATION: ${cameraStation}`,
        '',
        'INCIDENT DETAILS:',
        incidentDetails,
      ].join('\n');
      formData.append('description', fullDescription);
      formData.append('type', incidentType);
      formData.append('priority', priority);
      formData.append('incidentAt', new Date(incidentDate).toISOString());

      // Append all selected photos to attachments field
      photos.forEach((photo) => {
        formData.append('attachments', photo.file);
      });

      await api.post('/complaints', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      setSubmitSuccess(true);
      setSubmitError(null);
      setTimeout(() => navigate('/complaints'), 2000);
    },
    onError: (err: any) => {
      setSubmitError(err.response?.data?.message || 'Failed to file case. Please try again.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentDetails.trim()) { setSubmitError('Incident details are required.'); return; }
    setSubmitError(null);
    fileCaseMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest">File a Security Case</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Submit an official incident report with suspect details and multiple suspect photos.
        </p>
      </div>

      {submitSuccess && (
        <div className="border border-slate-300 bg-slate-50 px-4 py-3">
          <p className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Case filed successfully. Redirecting to complaints portal...
          </p>
        </div>
      )}

      {submitError && (
        <div className="border border-red-300 bg-red-50 px-4 py-3">
          <p className="text-xs font-black text-red-800 uppercase tracking-wider">{submitError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1 */}
        <Card>
          <CardHeader>
            <CardTitle>Section 1 — Complainant Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Full Name *" value={filerName} onChange={e => setFilerName(e.target.value)} required />
              <Input label="Email Address *" type="email" value={filerEmail} onChange={e => setFilerEmail(e.target.value)} required />
              <Input label="Phone Number" value={filerPhone} onChange={e => setFilerPhone(e.target.value)} placeholder="+91-XXXXX-XXXXX" />
              <Input label="Department / Address" value={filerAddress} onChange={e => setFilerAddress(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Section 2 */}
        <Card>
          <CardHeader>
            <CardTitle>Section 2 — Suspect Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Suspect Name (if known)" value={suspectName} onChange={e => setSuspectName(e.target.value)} placeholder="Unknown / Unidentified" />
              <Input label="Approximate Age" value={suspectAge} onChange={e => setSuspectAge(e.target.value)} placeholder="e.g. 25-30" />
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-800">Gender</label>
                <select
                  value={suspectGender}
                  onChange={e => setSuspectGender(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black"
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-800">Physical Description</label>
              <textarea
                value={suspectDescription}
                onChange={e => setSuspectDescription(e.target.value)}
                placeholder="Height, build, clothing, identifying features..."
                rows={3}
                className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black resize-none"
              />
            </div>

            {/* Suspect Photo Uploads */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-800">
                Suspect Photo Attachments / Evidence (Multiple Uploads Allowed)
              </label>
              <div className="space-y-3">
                <div>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="border border-slate-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                  >
                    Add Photo
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1">Select one or more image files (JPG, PNG — Max 10 MB per file)</p>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </div>

                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-3 pt-2">
                    {photos.map((item, index) => (
                      <div key={index} className="border border-slate-300 bg-white w-28 overflow-hidden">
                        <img src={item.preview} alt={`Suspect ${index + 1}`} className="h-24 w-full object-cover" />
                        <div className="border-t border-slate-200 px-2 py-1 text-center bg-slate-50">
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="text-[9px] font-bold uppercase text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3 */}
        <Card>
          <CardHeader>
            <CardTitle>Section 3 — Incident Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-800">Incident Category *</label>
                <select
                  value={incidentType}
                  onChange={e => setIncidentType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black"
                >
                  <option value="unauthorized_access">Unauthorized Access / Intrusion</option>
                  <option value="false_detection">False Identification Alert</option>
                  <option value="camera_issue">Camera Tampering / Damage</option>
                  <option value="system_error">System Malfunction</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-800">Priority *</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <Input label="Incident Date *" type="date" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} required />
              <Input label="Camera Station" value={cameraStation} onChange={e => setCameraStation(e.target.value)} placeholder="e.g. Camera 04 — Entrance Gate" />
            </div>

            <Input label="Incident Location *" value={incidentLocation} onChange={e => setIncidentLocation(e.target.value)} placeholder="e.g. Main Gate, Parking Lot B" required />

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-800">Incident Details *</label>
              <textarea
                value={incidentDetails}
                onChange={e => setIncidentDetails(e.target.value)}
                placeholder="Describe the sequence of events, observations, and actions taken..."
                rows={5}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black resize-none"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/complaints')}>Cancel</Button>
          <Button type="submit" isLoading={fileCaseMutation.isPending}>Submit Case</Button>
        </div>
      </form>
    </div>
  );
};
export default FileCase;
