/**
 * index.ts (types)
 * Shared TypeScript interfaces and enums used across the backend.
 */

import { Request } from 'express';
import { Types } from 'mongoose';

// ──────────────────────────────────────────
// User Types
// ──────────────────────────────────────────

export type UserRole = 'admin' | 'station';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ──────────────────────────────────────────
// Camera Types
// ──────────────────────────────────────────

export type CameraStatus = 'online' | 'offline' | 'maintenance';
export type CameraType = 'ip' | 'rtsp' | 'usb' | 'cloud';

export interface ICameraLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface ICamera {
  _id: Types.ObjectId;
  name: string;
  location: ICameraLocation | string;
  rtspUrl?: string;
  ipAddress?: string;
  type: CameraType;
  status: CameraStatus;
  isActive: boolean;
  lastActive?: Date;
  addedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ──────────────────────────────────────────
// Video Types
// ──────────────────────────────────────────

export type VideoStatus = 'uploaded' | 'queued' | 'processing' | 'completed' | 'failed';
export type VideoSourceType = 'REGISTERED_CCTV' | 'OTHER_LOCATION';

export interface IVideo {
  _id: Types.ObjectId;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  duration?: number;
  path: string;
  uploadedBy: Types.ObjectId;
  sourceType?: VideoSourceType;
  location?: {
    name?: string;
    latitude?: number;
    longitude?: number;
  };
  recordedAt?: Date;
  cameraId?: Types.ObjectId;
  status: VideoStatus;
  processingResult?: object;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ──────────────────────────────────────────
// Sighting Types
// ──────────────────────────────────────────

export type SightingIdentityType = 'KNOWN' | 'UNKNOWN';
export type SightingSourceType = 'LIVE_CCTV' | 'UPLOADED_VIDEO';

export interface ISightingLocationType {
  name: string;
  latitude: number;
  longitude: number;
}

export interface ISightingType {
  _id: Types.ObjectId;
  identityType: SightingIdentityType;
  personId?: Types.ObjectId;
  unknownPersonId?: Types.ObjectId;
  cameraId?: Types.ObjectId;
  videoId?: Types.ObjectId;
  sourceType: SightingSourceType;
  location: ISightingLocationType;
  locationAvailable: boolean;
  detectedAt: Date;
  videoTimestampSeconds?: number;
  similarity: number;
  snapshotObjectKey?: string;
  trackId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ──────────────────────────────────────────
// Recognition Types
// ──────────────────────────────────────────

export interface IRecognitionLog {
  _id: Types.ObjectId;
  personName?: string;
  isUnknown: boolean;
  confidence: number;
  cameraId?: Types.ObjectId;
  videoId?: Types.ObjectId;
  snapshot?: string;
  timestamp: Date;
  createdAt: Date;
}

export interface IUnknownFace {
  _id: Types.ObjectId;
  snapshot: string;
  cameraId?: Types.ObjectId;
  videoId?: Types.ObjectId;
  confidence: number;
  isAlerted: boolean;
  timestamp: Date;
  createdAt: Date;
}

// ──────────────────────────────────────────
// Recurring Unknown Person Types
// ──────────────────────────────────────────

export type UnknownPersonStatus = 'UNKNOWN' | 'RECURRING' | 'REVIEW_REQUIRED';

export interface IUnknownPersonAppearanceType {
  videoId?: Types.ObjectId;
  cameraId?: Types.ObjectId;
  timestamp: Date;
  detectedAt: Date;
  snapshotObjectKey: string;
  trackId?: number;
  similarity: number;
  qualityScore: number;
}

export interface IUnknownPersonType {
  _id: Types.ObjectId;
  unknownId: string;
  representativeSnapshot: string;
  status: UnknownPersonStatus;
  appearanceCount: number;
  distinctVideoCount: number;
  distinctCameraCount: number;
  firstSeen: Date;
  lastSeen: Date;
  appearances: IUnknownPersonAppearanceType[];
  isReviewed: boolean;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewAction?: 'reviewed' | 'associated' | 'dismissed';
  associatedCaseId?: Types.ObjectId;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ──────────────────────────────────────────
// Complaint (Missing Person Report) Types
// ──────────────────────────────────────────

export type ComplaintStatus =
  | 'complaint_registered'
  | 'under_investigation'
  | 'searching_cctv'
  | 'possible_match_found'
  | 'match_confirmed'
  | 'false_match'
  | 'person_found'
  | 'case_closed';

export interface IComplaint {
  _id: Types.ObjectId;
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
  lastSeenTime: Date;
  clothesWorn?: string;
  identifyingMarks?: string;
  medicalConditions?: string;
  additionalDescription?: string;
  attachments?: string[];
  searchVector?: number[];

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

  // Case
  status: ComplaintStatus;
  assignedTo?: Types.ObjectId;
  remarks?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ──────────────────────────────────────────
// Case History Types
// ──────────────────────────────────────────

export interface ICaseHistory {
  _id: Types.ObjectId;
  complaintId: Types.ObjectId;
  status: ComplaintStatus;
  remarks?: string;
  evidenceImages?: string[];
  cctvCameraId?: string;
  detectionTimestamp?: Date;
  confidenceScore?: number;
  updatedBy?: Types.ObjectId;
  smsSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ──────────────────────────────────────────
// Notification Types
// ──────────────────────────────────────────

export type NotificationType = 'alert' | 'info' | 'warning' | 'success';

export interface INotification {
  _id: Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  userId?: Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
}

// ──────────────────────────────────────────
// Express Request Extension
// ──────────────────────────────────────────

export interface AuthRequest extends Request {
  user?: IUser;
}

// ──────────────────────────────────────────
// API Response Types
// ──────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: PaginationMeta;
}
