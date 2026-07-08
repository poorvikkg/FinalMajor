/**
 * jwt.ts
 * Utility functions for creating and verifying JWT tokens.
 * Keeps all JWT logic in one place for easy auditing.
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Types } from 'mongoose';

interface TokenPayload {
  userId: string;
  role: string;
}

// Generate a signed JWT for a user
export function signToken(userId: Types.ObjectId, role: string): string {
  return jwt.sign(
    { userId: userId.toString(), role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn } as jwt.SignOptions
  );
}

// Verify a token and return its payload, or null if invalid
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.jwtSecret) as TokenPayload;
  } catch {
    return null; // token is expired, tampered, or invalid
  }
}
