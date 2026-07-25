export type UserRole = 'admin' | 'station';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export type CameraStatus = 'online' | 'offline' | 'maintenance';
export type CameraType = 'ip' | 'rtsp' | 'usb' | 'cloud';

export interface CameraLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface Camera {
  _id: string;
  name: string;
  location: CameraLocation | string;
  rtspUrl?: string;
  ipAddress?: string;
  type: CameraType;
  status: CameraStatus;
  isActive: boolean;
  lastActive?: string;
  addedBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type VideoStatus = 'uploaded' | 'queued' | 'processing' | 'completed' | 'failed';
export type VideoSourceType = 'REGISTERED_CCTV' | 'OTHER_LOCATION';

export interface Video {
  _id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  duration?: number;
  path: string;
  uploadedBy: {
    _id: string;
    name: string;
    email: string;
  };
  sourceType?: VideoSourceType;
  location?: {
    name?: string;
    latitude?: number;
    longitude?: number;
  };
  recordedAt?: string;
  cameraId?: string | {
    _id: string;
    name: string;
    location: CameraLocation | string;
  };
  status: VideoStatus;
  processingResult?: {
    recognizedPersons?: Array<{ name: string; confidence: number; timestamp: number }>;
    unknownPersonsCount?: number;
    timeline?: Array<{ timestamp: number; label: string }>;
  };
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// ──────────────────────────────────────────
// Sighting Types
// ──────────────────────────────────────────

export type SightingIdentityType = 'KNOWN' | 'UNKNOWN';
export type SightingSourceType = 'LIVE_CCTV' | 'UPLOADED_VIDEO';

export interface SightingLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface Sighting {
  _id: string;
  identityType: SightingIdentityType;
  personId?: {
    _id: string;
    complaintId?: string;
    missingPersonName?: string;
    attachments?: string[];
    status?: string;
  };
  unknownPersonId?: {
    _id: string;
    unknownId: string;
    status: 'UNKNOWN' | 'RECURRING' | 'REVIEW_REQUIRED';
    representativeSnapshot?: string;
  };
  cameraId?: {
    _id: string;
    name: string;
    location: CameraLocation | string;
    status: string;
  };
  videoId?: {
    _id: string;
    originalName: string;
    filename: string;
    location?: { name?: string; latitude?: number; longitude?: number };
    recordedAt?: string;
  };
  sourceType: SightingSourceType;
  location: SightingLocation;
  locationAvailable: boolean;
  detectedAt: string;
  videoTimestampSeconds?: number;
  similarity: number;
  snapshotObjectKey?: string;
  trackId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecognitionLog {
  _id: string;
  personName?: string;
  isUnknown: boolean;
  confidence: number;
  cameraId?: {
    _id: string;
    name: string;
    location: string;
  };
  videoId?: {
    _id: string;
    originalName: string;
  };
  snapshot?: string;
  timestamp: string;
  createdAt: string;
}

export interface UnknownFace {
  _id: string;
  snapshot: string;
  cameraId?: {
    _id: string;
    name: string;
    location: string;
  };
  videoId?: {
    _id: string;
    originalName: string;
  };
  confidence: number;
  isAlerted: boolean;
  timestamp: string;
  createdAt: string;
}

// ──────────────────────────────────────────
// Recurring Unknown Person Types
// ──────────────────────────────────────────

export type UnknownPersonStatus = 'UNKNOWN' | 'RECURRING' | 'REVIEW_REQUIRED';

export interface UnknownPersonAppearance {
  videoId?: {
    _id: string;
    originalName: string;
  };
  cameraId?: {
    _id: string;
    name: string;
    location: string;
  };
  timestamp: string;
  detectedAt: string;
  snapshotObjectKey: string;
  trackId?: number;
  similarity: number;
  qualityScore: number;
}

export interface UnknownPerson {
  _id: string;
  unknownId: string;
  representativeSnapshot: string;
  status: UnknownPersonStatus;
  appearanceCount: number;
  distinctVideoCount: number;
  distinctCameraCount: number;
  firstSeen: string;
  lastSeen: string;
  appearances: UnknownPersonAppearance[];
  isReviewed: boolean;
  reviewedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  reviewedAt?: string;
  reviewAction?: 'reviewed' | 'associated' | 'dismissed';
  associatedCaseId?: {
    _id: string;
    complaintId?: string;
    missingPersonName?: string;
    status?: string;
  };
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// ──────────────────────────────────────────
// Complaint (Missing Person Report) Types
// ──────────────────────────────────────────

export type ComplaintPriority = 'low' | 'medium' | 'high' | 'critical';

export type ComplaintStatus =
  | 'complaint_registered'
  | 'under_investigation'
  | 'searching_cctv'
  | 'possible_match_found'
  | 'match_confirmed'
  | 'false_match'
  | 'person_found'
  | 'case_closed';

export interface Complaint {
  _id: string;
  complaintId?: string;

  // Missing Person
  missingPersonName?: string;
  age?: string;
  gender: 'male' | 'female' | 'other' | 'unknown';
  height?: string;
  weight?: string;
  skinTone?: string;
  hairColor?: string;
  eyeColor?: string;
  lastSeenLocation: string;
  lastSeenTime: string;
  clothesWorn?: string;
  identifyingMarks?: string;
  medicalConditions?: string;
  additionalDescription?: string;
  attachments?: string[];

  // Complainant
  reporterName: string;
  reporterMobile: string;
  reporterAltMobile?: string;
  reporterEmail?: string;
  reporterRelationship?: string;
  reporterAddress?: string;
  reporterGovtId?: string;

  // Police Case
  policeStation?: string;
  officerName?: string;
  firNumber?: string;  // FIR Number assigned by police

  // Case Management
  status: ComplaintStatus;
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
  remarks?: string;
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ──────────────────────────────────────────
// Case History
// ──────────────────────────────────────────

export interface CaseHistory {
  _id: string;
  complaintId: string;
  status: ComplaintStatus;
  remarks?: string;
  evidenceImages?: string[];
  cctvCameraId?: string;
  detectionTimestamp?: string;
  confidenceScore?: number;
  updatedBy?: {
    _id: string;
    name: string;
  };
  smsSent: boolean;
  createdAt: string;
}

// ──────────────────────────────────────────
// Dashboard / System Types
// ──────────────────────────────────────────

export interface SystemStats {
  users: { total: number };
  cameras: {
    total: number;
    online: number;
    offline: number;
    maintenance: number;
  };
  videos: { processed: number };
  recognitions: {
    today: number;
    unknownDetections: number;
  };
}

export interface RecentAlert {
  _id: string;
  cameraId?: {
    _id: string;
    name: string;
    location: string;
  };
  timestamp: string;
  confidence: number;
  isUnknown: boolean;
}

export interface RecentComplaint {
  _id: string;
  complaintId?: string;
  reporterName: string;
  missingPersonName?: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  createdAt: string;
}

export interface SystemLog {
  _id: string;
  userId?: {
    _id: string;
    name: string;
  };
  action: string;
  resource: string;
  details?: object;
  createdAt: string;
}
