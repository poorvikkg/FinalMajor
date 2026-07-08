/**
 * camera.validator.ts
 * Zod schemas for camera CRUD requests.
 */

import { z } from 'zod';

export const createCameraSchema = z.object({
  name: z.string().min(2).max(100),
  location: z.string().min(2).max(200),
  rtspUrl: z.string().url().optional(),
  ipAddress: z.string().optional(),
  type: z.enum(['ip', 'rtsp', 'usb', 'cloud']),
  status: z.enum(['online', 'offline', 'maintenance']).default('offline'),
  isActive: z.boolean().default(true),
});

export const updateCameraSchema = createCameraSchema.partial();

export type CreateCameraInput = z.infer<typeof createCameraSchema>;
export type UpdateCameraInput = z.infer<typeof updateCameraSchema>;
