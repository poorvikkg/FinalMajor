/**
 * complaint.validator.ts
 * Zod schemas for complaint creation and status update requests.
 */

import { z } from 'zod';

const COMPLAINT_STATUSES = [
  'complaint_registered',
  'under_investigation',
  'searching_cctv',
  'possible_match_found',
  'match_confirmed',
  'false_match',
  'person_found',
  'case_closed',
] as const;

export const createComplaintSchema = z.object({
  // Missing Person
  missingPersonName: z.string().optional(),
  age: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).default('unknown'),
  height: z.string().optional(),
  weight: z.string().optional(),
  skinTone: z.string().optional(),
  hairColor: z.string().optional(),
  eyeColor: z.string().optional(),
  lastSeenLocation: z.string().min(2, 'Last seen location is required'),
  lastSeenTime: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid date/time format' }
  ),
  clothesWorn: z.string().max(2000).optional(),
  identifyingMarks: z.string().max(2000).optional(),
  medicalConditions: z.string().max(1000).optional(),
  additionalDescription: z.string().max(3000).optional(),
  attachments: z.array(z.string()).optional(),

  // Complainant
  reporterName: z.string().min(2, 'Reporter name is required').max(100),
  reporterMobile: z.string().min(7, 'Mobile number is required'),
  reporterAltMobile: z.string().optional(),
  reporterEmail: z.string().email().optional().or(z.literal('')),
  reporterRelationship: z.string().optional(),
  reporterAddress: z.string().optional(),
  reporterGovtId: z.string().optional(),

  // Police Case
  policeStation: z.string().optional(),
  officerName: z.string().optional(),
  firNumber: z.string().optional(), // FIR Number issued by police station
});

export const updateComplaintStatusSchema = z.object({
  status: z.enum(COMPLAINT_STATUSES),
  remarks: z.string().max(2000).optional(),
  cctvCameraId: z.string().optional(),
  detectionTimestamp: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: 'Invalid detection timestamp' }
  ),
  confidenceScore: z.number().min(0).max(100).optional(),
  evidenceImages: z.array(z.string()).optional(),
});

// Legacy update schema (kept for backwards compat with admin status overrides)
export const updateComplaintSchema = z.object({
  status: z.enum(COMPLAINT_STATUSES).optional(),
  assignedTo: z.string().optional(),
  remarks: z.string().max(1000).optional(),
  firNumber: z.string().optional(),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintStatusInput = z.infer<typeof updateComplaintStatusSchema>;
export type UpdateComplaintInput = z.infer<typeof updateComplaintSchema>;
