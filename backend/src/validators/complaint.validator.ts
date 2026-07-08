/**
 * complaint.validator.ts
 * Zod schemas for complaint creation and update requests.
 */

import { z } from 'zod';

export const createComplaintSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  type: z.enum(['camera_issue', 'false_detection', 'system_error', 'unauthorized_access', 'other']),
  cameraId: z.string().optional(),
  incidentAt: z.string().datetime({ message: 'Invalid date/time format' }),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  attachments: z.array(z.string()).optional(),
});

export const updateComplaintSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  assignedTo: z.string().optional(),
  remarks: z.string().max(1000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintInput = z.infer<typeof updateComplaintSchema>;
