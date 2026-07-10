/**
 * auth.validator.ts
 * Zod schemas for validating auth request bodies.
 */

import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(3, 'Username/Email must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().min(3, 'Username/Email must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.literal('station').default('station'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
