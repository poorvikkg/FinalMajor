/**
 * dashboard.routes.ts
 * Routes for dashboard statistics and activity feeds.
 */

import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/stats', dashboardController.getStats);
router.get('/alerts', dashboardController.getRecentAlerts);
router.get('/activity', dashboardController.getRecentActivity);

export default router;
