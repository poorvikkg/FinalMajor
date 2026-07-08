/**
 * auth.middleware.ts
 * Checks that the request has a valid JWT token.
 * Attaches the user object to req.user for downstream handlers.
 */

import { Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { User } from '../models/User';
import { sendError } from '../utils/response';
import { AuthRequest } from '../types';

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Extract token from Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'No token provided', 401);
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload) {
    sendError(res, 'Invalid or expired token', 401);
    return;
  }

  // Load the full user from the DB to get the latest role and isActive status
  const user = await User.findById(payload.userId).select('+password').lean();
  if (!user || !user.isActive) {
    sendError(res, 'Account not found or deactivated', 401);
    return;
  }

  req.user = user as any;
  next();
}
