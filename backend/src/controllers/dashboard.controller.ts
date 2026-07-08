/**
 * dashboard.controller.ts
 * Handles requests for dashboard data (stats, alerts, activity).
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as dashboardService from '../services/dashboard.service';
import { sendSuccess } from '../utils/response';

export async function getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await dashboardService.getDashboardStats();
    sendSuccess(res, 'Dashboard stats retrieved', stats);
  } catch (err) {
    next(err);
  }
}

export async function getRecentAlerts(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const alerts = await dashboardService.getRecentAlerts(5);
    sendSuccess(res, 'Recent alerts retrieved', alerts);
  } catch (err) {
    next(err);
  }
}

export async function getRecentActivity(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const activity = await dashboardService.getRecentActivity(10);
    sendSuccess(res, 'Recent activity retrieved', activity);
  } catch (err) {
    next(err);
  }
}
