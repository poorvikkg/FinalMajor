/**
 * Complaint.ts (Missing Person Report)
 * Stores missing person reports submitted by neighbors or relatives.
 * Expanded with full missing person details, complainant info, and police case data.
 */

import mongoose, { Schema, Document } from 'mongoose';
import { IComplaint } from '../types';

export interface IComplaintDocument extends Omit<IComplaint, '_id'>, Document {}

const ComplaintSchema = new Schema<IComplaintDocument>(
  {
    // ── Auto-generated Complaint ID ──────────────────────────
    complaintId: {
      type: String,
      unique: true,
      // Generated in service before save: MP-YYYYMMDD-XXXX
    },

    // ── Section A: Missing Person Details ────────────────────
    missingPersonName: { type: String, trim: true },
    age: { type: String, trim: true },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'unknown'],
      default: 'unknown',
    },
    height: { type: String, trim: true },        // e.g. "5'8\""
    weight: { type: String, trim: true },        // e.g. "65 kg"
    skinTone: { type: String, trim: true },      // e.g. "Fair", "Wheatish", "Dark"
    hairColor: { type: String, trim: true },
    eyeColor: { type: String, trim: true },
    lastSeenLocation: {
      type: String,
      required: [true, 'Last seen location is required'],
      trim: true,
    },
    lastSeenTime: {
      type: Date,
      required: [true, 'Last seen time is required'],
    },
    clothesWorn: { type: String, maxlength: 2000 },      // renamed from clothingDescription
    identifyingMarks: { type: String, maxlength: 2000 }, // scars, tattoos, birthmarks
    medicalConditions: { type: String, maxlength: 1000 },
    additionalDescription: { type: String, maxlength: 3000 },

    // ── Photographs ──────────────────────────────────────────
    attachments: [{ type: String }], // MinIO URLs of uploaded photos

    // ── Section B: Complainant (Relative/Neighbor) Details ───
    reporterName: {
      type: String,
      required: [true, 'Reporter name is required'],
      trim: true,
    },
    reporterMobile: {
      type: String,
      required: [true, 'Reporter mobile is required'],
      trim: true,
    },
    reporterAltMobile: { type: String, trim: true },
    reporterEmail: { type: String, trim: true, lowercase: true },
    reporterRelationship: { type: String, trim: true }, // e.g. "Father", "Neighbor"
    reporterAddress: { type: String, trim: true },
    reporterGovtId: { type: String, trim: true },       // Aadhaar / DL number

    // ── Section C: Police Case Details ───────────────────────
    policeStation: { type: String, trim: true },
    officerName: { type: String, trim: true },

    // ── Case Management ───────────────────────────────────────
    status: {
      type: String,
      enum: [
        'complaint_registered',
        'under_investigation',
        'searching_cctv',
        'possible_match_found',
        'match_confirmed',
        'false_match',
        'person_found',
        'case_closed',
      ],
      default: 'complaint_registered',
    },
    firNumber: { type: String, trim: true }, // FIR No. assigned by police station
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    remarks: { type: String, maxlength: 1000 },

    // ── Vector Search (future) ───────────────────────────────
    searchVector: { type: [Number], default: [] },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

ComplaintSchema.index({ status: 1 });
ComplaintSchema.index({ priority: 1 });
ComplaintSchema.index({ createdAt: -1 });
ComplaintSchema.index({ assignedTo: 1 });
ComplaintSchema.index({ createdBy: 1 });
ComplaintSchema.index({ complaintId: 1 });

export const Complaint = mongoose.model<IComplaintDocument>('Complaint', ComplaintSchema);
