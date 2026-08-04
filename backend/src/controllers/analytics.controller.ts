/**
 * analytics.controller.ts
 * REST endpoints for the AI Threat Intelligence Engine & Analytics.
 */

import { Request, Response, NextFunction } from 'express';
import * as analyticsService from '../services/analytics.service';

/** GET /analytics/threat-leaderboard */
export async function getThreatLeaderboard(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const leaderboard = await analyticsService.getThreatLeaderboard(limit);
    res.json({ success: true, data: leaderboard });
  } catch (err) {
    next(err);
  }
}

/** GET /analytics/hourly-detections */
export async function getHourlyDetections(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getHourlyDetections();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /analytics/heatmap */
export async function getHeatmap(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getDetectionHeatmap();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /analytics/summary */
export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getAnalyticsSummary();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** GET /analytics/prediction/:alertId */
export async function getPrediction(req: Request, res: Response, next: NextFunction) {
  try {
    const { alertId } = req.params;
    const data = await analyticsService.predictNextCameras(alertId);
    if (!data) {
      res.json({ success: true, data: null, message: 'Insufficient relay chain data for prediction' });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
