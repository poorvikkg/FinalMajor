/**
 * response.ts
 * Helper functions to send consistent API responses.
 * Every endpoint uses these helpers so the response format never varies.
 */

import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../types';

// Send a successful response
export function sendSuccess<T>(
  res: Response,
  message: string,
  data?: T,
  statusCode = 200
): Response {
  const body: ApiResponse<T> = { success: true, message, data };
  return res.status(statusCode).json(body);
}

// Send a success response with pagination info
export function sendPaginated<T>(
  res: Response,
  message: string,
  data: T,
  pagination: PaginationMeta
): Response {
  const body: ApiResponse<T> = { success: true, message, data, pagination };
  return res.status(200).json(body);
}

// Send an error response
export function sendError(res: Response, message: string, statusCode = 400): Response {
  const body: ApiResponse = { success: false, message };
  return res.status(statusCode).json(body);
}
