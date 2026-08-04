/**
 * suspectAlert.routes.ts
 * Routes for the Suspect Relay Chase Network alert management API.
 */

import { Router } from 'express';
import {
  listAlerts,
  getAlert,
  resolveAlert,
  getAlertTrail,
} from '../controllers/suspectAlert.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List all alerts (admin + station)
router.get('/', listAlerts);

// Get single alert detail
router.get('/:alertId', getAlert);

// Get the spatial relay trail for a specific alert
router.get('/:alertId/trail', getAlertTrail);

// Resolve an alert (admin only)
router.post('/:alertId/resolve', requireRole('admin'), resolveAlert);

export default router;
