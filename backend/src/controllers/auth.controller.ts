/**
 * auth.controller.ts
 * Handles HTTP requests for authentication endpoints.
 * Delegates business logic to auth.service.ts.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as authService from '../services/auth.service';
import { sendSuccess } from '../utils/response';

export async function register(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.register(req.body);
    sendSuccess(res, 'Account created successfully', result, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, 'Login successful', result);
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getMe(req.user!._id.toString());
    sendSuccess(res, 'User profile retrieved', user);
  } catch (err) {
    next(err);
  }
}

// Logout is handled client-side by removing the JWT token.
// We just send a success response.
export function logout(_req: AuthRequest, res: Response): void {
  sendSuccess(res, 'Logged out successfully');
}
