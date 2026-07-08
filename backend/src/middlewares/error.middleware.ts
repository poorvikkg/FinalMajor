/**
 * error.middleware.ts
 * Central error handling middleware.
 * All unhandled errors bubble up here. We format them into a clean JSON response.
 * This prevents stack traces from leaking to the client in production.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { env } from '../config/env';

// Custom error class with an HTTP status code
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Global error handler — must have 4 parameters for Express to recognize it
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');

  // Handle known operational errors (thrown via AppError)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(422).json({ success: false, message: err.message });
    return;
  }

  // Handle duplicate key errors (e.g. duplicate email)
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue || {})[0];
    res.status(409).json({ success: false, message: `${field} already exists` });
    return;
  }

  // Generic server error — hide details in production
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(env.isDev && { stack: err.stack }), // show stack trace only in dev
  });
}
