/**
 * camera.validator.ts
 * Zod schemas for camera CRUD requests.
 */

import { z } from 'zod';

const cameraLocationObjectSchema = z.object({
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const createCameraSchema = z.object({
  name: z.string().min(2).max(100),
  location: z.union([z.string().min(2).max(200), cameraLocationObjectSchema]),
  rtspUrl: z.string().optional(),
  ipAddress: z.string().optional(),
  type: z.enum(['ip', 'rtsp', 'usb', 'cloud']),
  status: z.enum(['online', 'offline', 'maintenance']).default('offline'),
  isActive: z.boolean().default(true),
});

export const updateCameraSchema = createCameraSchema.partial();

export type CreateCameraInput = z.infer<typeof createCameraSchema>;
export type UpdateCameraInput = z.infer<typeof updateCameraSchema>;
