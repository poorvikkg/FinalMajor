/**
 * role.middleware.ts
 * Factory function that returns a middleware to check if the user
 * has one of the required roles. Always use AFTER authenticate middleware.
 *
 * Usage: router.get('/admin', authenticate, requireRole('admin'), handler)
 */

import { Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { AuthRequest, UserRole } from '../types';

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Not authenticated', 401);
      return;
    }

    if (!roles.includes(req.user.role)) {
      sendError(res, 'You do not have permission to perform this action', 403);
      return;
    }

    next();
  };
}
