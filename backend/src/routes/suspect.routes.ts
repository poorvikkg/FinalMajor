/**
 * suspect.routes.ts
 *
 * REST API for suspects (clustered unknown persons).
 */

import { Router } from 'express';
import * as suspectController from '../controllers/suspect.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const router = Router();

router.use(authenticate);

router.get('/', suspectController.getSuspects);
router.get('/stats', suspectController.getStats);
router.get('/:id', suspectController.getSuspectById);

// Admin/Station only actions
router.post('/:id/resolve', requireRole('admin', 'station'), suspectController.resolveSuspect);
router.put('/:id/notes', requireRole('admin', 'station'), suspectController.updateNotes);

export default router;
