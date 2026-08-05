/**
 * zone.routes.ts
 * Geofence zone management API.
 */

import { Router } from 'express';
import * as zoneController from '../controllers/zone.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const router = Router();
router.use(authenticate);

router.get('/', zoneController.listZones);
router.post('/', requireRole('admin'), zoneController.createZone);
router.delete('/:zoneId', requireRole('admin'), zoneController.deleteZone);
router.patch('/:zoneId/toggle', requireRole('admin'), zoneController.toggleZone);
router.post('/:zoneId/trigger-scan', requireRole('admin'), zoneController.triggerZoneScan);
router.post('/:zoneId/stop-scan', requireRole('admin'), zoneController.stopZoneScan);

export default router;
