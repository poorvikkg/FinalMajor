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

const SKIN_TONES = ['Fair', 'Light', 'Wheatish', 'Olive', 'Brown', 'Dark', 'Unknown'];
const HAIR_COLORS = ['Black', 'Brown', 'Blonde', 'Grey', 'White', 'Red', 'Bald', 'Unknown'];
const EYE_COLORS = ['Black', 'Brown', 'Hazel', 'Green', 'Blue', 'Grey', 'Unknown'];

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-800">
    {children}
  </label>
);

const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <div>
    <SectionLabel>{label}</SectionLabel>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

export const FileCase: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Section A: Missing Person ──────────────────────────
  const [missingPersonName, setMissingPersonName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('unknown');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [skinTone, setSkinTone] = useState('Unknown');
  const [hairColor, setHairColor] = useState('Unknown');
  const [eyeColor, setEyeColor] = useState('Unknown');
  const [lastSeenLocation, setLastSeenLocation] = useState('');
  const [lastSeenTime, setLastSeenTime] = useState(new Date().toISOString().slice(0, 16));
  const [clothesWorn, setClothesWorn] = useState('');
  const [identifyingMarks, setIdentifyingMarks] = useState('');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [additionalDescription, setAdditionalDescription] = useState('');
  const [photos, setPhotos] = useState<PhotoAttachment[]>([]);

  // ── Section B: Complainant ──────────────────────────────
  const [reporterName, setReporterName] = useState(user?.name || '');
  const [reporterMobile, setReporterMobile] = useState('');
  const [reporterAltMobile, setReporterAltMobile] = useState('');
  const [reporterEmail, setReporterEmail] = useState(user?.email || '');
  const [reporterRelationship, setReporterRelationship] = useState('');
  const [reporterAddress, setReporterAddress] = useState('');
  const [reporterGovtId, setReporterGovtId] = useState('');

  // ── Section C: Police Case ──────────────────────────────
  const [policeStation, setPoliceStation] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('high');

  // ── UI State ─────────────────────────────────────────────
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      selected.forEach((file) => {
        if (!file.type.startsWith('image/')) {
          setSubmitError('Only image files are allowed.');
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          setSubmitError('Each photo must be under 10 MB.');
          return;
        }
        setSubmitError(null);
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPhotos((prev) => [...prev, { file, preview: ev.target?.result as string }]);
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    }
  };

  const removePhoto = (index: number) => setPhotos((p) => p.filter((_, i) => i !== index));

  const fileCaseMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();

      // Section A
      if (missingPersonName) fd.append('missingPersonName', missingPersonName);
      if (age) fd.append('age', age);
      fd.append('gender', gender);
      if (height) fd.append('height', height);
      if (weight) fd.append('weight', weight);
      fd.append('skinTone', skinTone);
      fd.append('hairColor', hairColor);
      fd.append('eyeColor', eyeColor);
      fd.append('lastSeenLocation', lastSeenLocation);
      fd.append('lastSeenTime', new Date(lastSeenTime).toISOString());
      if (clothesWorn) fd.append('clothesWorn', clothesWorn);
      if (identifyingMarks) fd.append('identifyingMarks', identifyingMarks);
      if (medicalConditions) fd.append('medicalConditions', medicalConditions);
      if (additionalDescription) fd.append('additionalDescription', additionalDescription);
      photos.forEach((p) => fd.append('attachments', p.file));

      // Section B
      fd.append('reporterName', reporterName);
      fd.append('reporterMobile', reporterMobile);
      if (reporterAltMobile) fd.append('reporterAltMobile', reporterAltMobile);
      if (reporterEmail) fd.append('reporterEmail', reporterEmail);
      if (reporterRelationship) fd.append('reporterRelationship', reporterRelationship);
      if (reporterAddress) fd.append('reporterAddress', reporterAddress);
      if (reporterGovtId) fd.append('reporterGovtId', reporterGovtId);

      // Section C
      if (policeStation) fd.append('policeStation', policeStation);
      if (officerName) fd.append('officerName', officerName);
      fd.append('priority', priority);

      const res = await api.post('/complaints', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setSubmitError(null);
      setSubmittedId(data?.complaintId || data?._id || 'Filed');
    },
    onError: (err: any) => {
      const d = err.response?.data;
      if (d?.errors && Array.isArray(d.errors)) {
        setSubmitError(d.errors.map((e: any) => `${e.field}: ${e.message}`).join(' | '));
      } else {
        setSubmitError(d?.message || 'Failed to file report. Please try again.');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastSeenLocation.trim()) { setSubmitError('Last seen location is required.'); return; }
    if (!reporterName.trim()) { setSubmitError('Reporter name is required.'); return; }
    if (!reporterMobile.trim()) { setSubmitError('Reporter mobile number is required.'); return; }
    setSubmitError(null);
    fileCaseMutation.mutate();
  };

  // Success screen
  if (submittedId) {
    return (
      <div className="max-w-xl mx-auto pt-8 space-y-6">
        <div className="border border-green-300 bg-green-50 px-6 py-8 text-center space-y-3">
          <div className="text-3xl">✓</div>
          <h2 className="text-sm font-black text-green-900 uppercase tracking-widest">
            Report Filed Successfully
          </h2>
          <p className="text-xs text-green-800">
            Your missing person report has been registered.
          </p>
          <div className="bg-white border border-green-200 px-4 py-3 inline-block">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Your Complaint ID</p>
            <p className="text-xl font-black font-mono text-slate-900 mt-1">{submittedId}</p>
          </div>
          <p className="text-[11px] text-green-700">
            An SMS notification has been sent to your registered mobile number.
            Save this Complaint ID to track the status of your report.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate('/complaints')}>
            View My Reports
          </Button>
          <Button onClick={() => { setSubmittedId(null); fileCaseMutation.reset(); }}>
            File Another Report
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest">
          Report Missing Person
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Fill all three sections completely. This data will be used to search through CCTV footage across the surveillance network.
        </p>
      </div>

      {submitError && (
        <div className="border border-red-300 bg-red-50 px-4 py-3">
          <p className="text-xs font-bold text-red-800">{submitError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── SECTION A: Missing Person ──────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Section A — Missing Person Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Full Name (if known)"
                value={missingPersonName}
                onChange={(e) => setMissingPersonName(e.target.value)}
                placeholder="Unknown"
              />
              <Input
                label="Approximate Age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 25-30"
              />
              <SelectField
                label="Gender"
                value={gender}
                onChange={setGender}
                options={[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'other', label: 'Other' },
                  { value: 'unknown', label: 'Unknown' },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Height"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="e.g. 5ft 8in or 172 cm"
              />
              <Input
                label="Weight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 65 kg"
              />
              <SelectField
                label="Skin Tone"
                value={skinTone}
                onChange={setSkinTone}
                options={SKIN_TONES.map((s) => ({ value: s, label: s }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label="Hair Color"
                value={hairColor}
                onChange={setHairColor}
                options={HAIR_COLORS.map((c) => ({ value: c, label: c }))}
              />
              <SelectField
                label="Eye Color"
                value={eyeColor}
                onChange={setEyeColor}
                options={EYE_COLORS.map((c) => ({ value: c, label: c }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Last Seen Location *"
                value={lastSeenLocation}
                onChange={(e) => setLastSeenLocation(e.target.value)}
                placeholder="e.g. Main Gate, City Mall"
                required
              />
              <Input
                label="Last Seen Date & Time *"
                type="datetime-local"
                value={lastSeenTime}
                onChange={(e) => setLastSeenTime(e.target.value)}
                required
              />
            </div>

            <div>
              <SectionLabel>Clothes Worn at Last Sighting</SectionLabel>
              <textarea
                value={clothesWorn}
                onChange={(e) => setClothesWorn(e.target.value)}
                placeholder="Describe shirt, pants, shoes, bag, accessories in detail..."
                rows={3}
                className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black resize-none"
              />
            </div>

            <div>
              <SectionLabel>Identifying Marks</SectionLabel>
              <textarea
                value={identifyingMarks}
                onChange={(e) => setIdentifyingMarks(e.target.value)}
                placeholder="Scars, tattoos, birthmarks, physical disabilities, prosthetics..."
                rows={2}
                className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black resize-none"
              />
            </div>

            <div>
              <SectionLabel>Medical Conditions (optional)</SectionLabel>
              <textarea
                value={medicalConditions}
                onChange={(e) => setMedicalConditions(e.target.value)}
                placeholder="Any known medical conditions, requires medication, mental health conditions..."
                rows={2}
                className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black resize-none"
              />
            </div>

            <div>
              <SectionLabel>Additional Description</SectionLabel>
              <textarea
                value={additionalDescription}
                onChange={(e) => setAdditionalDescription(e.target.value)}
                placeholder="Any other relevant information about the missing person or circumstances..."
                rows={3}
                className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black resize-none"
              />
            </div>

            {/* Photo uploads */}
            <div>
              <SectionLabel>Recent Photograph(s) — Upload</SectionLabel>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="border border-slate-300 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                >
                  Add Photo
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {photos.map((item, i) => (
                      <div key={i} className="border border-slate-300 bg-white w-28 overflow-hidden">
                        <img src={item.preview} alt={`Photo ${i + 1}`} className="h-24 w-full object-cover" />
                        <div className="border-t border-slate-200 px-2 py-1 text-center bg-slate-50">
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
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

        {/* ── SECTION B: Complainant ──────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Section B — Complainant Details (Relative / Neighbor)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name *"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                required
              />
              <Input
                label="Relationship with Missing Person"
                value={reporterRelationship}
                onChange={(e) => setReporterRelationship(e.target.value)}
                placeholder="e.g. Father, Sister, Neighbor"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Mobile Number *"
                value={reporterMobile}
                onChange={(e) => setReporterMobile(e.target.value)}
                placeholder="+91 9XXXXXXXXX"
                required
              />
              <Input
                label="Alternate Mobile (optional)"
                value={reporterAltMobile}
                onChange={(e) => setReporterAltMobile(e.target.value)}
                placeholder="+91 9XXXXXXXXX"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email Address (optional)"
                type="email"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="example@email.com"
              />
              <Input
                label="Govt. ID Number (optional)"
                value={reporterGovtId}
                onChange={(e) => setReporterGovtId(e.target.value)}
                placeholder="Aadhaar / Driving License / Passport"
              />
            </div>
            <div>
              <SectionLabel>Full Address</SectionLabel>
              <textarea
                value={reporterAddress}
                onChange={(e) => setReporterAddress(e.target.value)}
                placeholder="House No., Street, Area, City, Pincode..."
                rows={2}
                className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── SECTION C: Police Case ──────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Section C — Police Case Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Police Station"
                value={policeStation}
                onChange={(e) => setPoliceStation(e.target.value)}
                placeholder="e.g. MG Road Police Station"
              />
              <Input
                label="Receiving Officer Name"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                placeholder="Officer's name"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <SectionLabel>Search Priority *</SectionLabel>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 bg-white text-black focus:outline-none focus:border-black"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <SectionLabel>Complaint ID</SectionLabel>
                <div className="px-3 py-2 text-xs border border-slate-200 bg-slate-50 text-slate-500 font-mono">
                  Auto-generated after submission
                </div>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 px-4 py-3">
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Initial status will be automatically set to <strong>Complaint Registered</strong>.
                An SMS will be sent to the complainant's mobile number upon submission.
                CCTV operators will be notified immediately.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/complaints')}>
            Cancel
          </Button>
          <Button type="submit" isLoading={fileCaseMutation.isPending}>
            Submit Report
          </Button>
        </div>
      </form>
    </div>
  );
};

export default FileCase;
