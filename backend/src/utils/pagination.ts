/**
 * pagination.ts
 * Parses page/limit from query params and builds MongoDB skip/limit values.
 * Also creates pagination metadata for the API response.
 */

import { Request } from 'express';
import { PaginationMeta } from '../types';

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

// Extract and validate pagination params from query string
export function getPaginationOptions(req: Request): PaginationOptions {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// Build the pagination metadata object for the response
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
