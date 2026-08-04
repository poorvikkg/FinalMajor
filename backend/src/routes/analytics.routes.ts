/**
 * analytics.routes.ts
 * AI Threat Intelligence & Analytics API endpoints.
 */

import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const router = Router();
router.use(authenticate);

router.get('/summary', analyticsController.getSummary);
router.get('/threat-leaderboard', analyticsController.getThreatLeaderboard);
router.get('/hourly-detections', analyticsController.getHourlyDetections);
router.get('/heatmap', analyticsController.getHeatmap);
router.get('/prediction/:alertId', requireRole('admin'), analyticsController.getPrediction);

export default router;
