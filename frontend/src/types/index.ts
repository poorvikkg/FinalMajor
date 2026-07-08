export type UserRole = 'admin' | 'operator' | 'viewer';

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

export interface Camera {
  _id: string;
  name: string;
  location: string;
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
  cameraId?: string | {
    _id: string;
    name: string;
    location: string;
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

export type ComplaintType =
  | 'camera_issue'
  | 'false_detection'
  | 'system_error'
  | 'unauthorized_access'
  | 'other';

export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Complaint {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  type: ComplaintType;
  cameraId?: {
    _id: string;
    name: string;
    location: string;
  };
  incidentAt: string;
  description: string;
  attachment?: string;
  priority: ComplaintPriority;
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
  name: string;
  type: ComplaintType;
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
