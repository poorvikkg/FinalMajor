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

export interface ICamera {
  _id: Types.ObjectId;
  name: string;
  location: string;
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

export interface IVideo {
  _id: Types.ObjectId;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  duration?: number;
  path: string;
  uploadedBy: Types.ObjectId;
  cameraId?: Types.ObjectId;
  status: VideoStatus;
  processingResult?: object;
  errorMessage?: string;
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
