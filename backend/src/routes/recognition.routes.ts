/**
 * recognition.routes.ts
 * Routes for recognition logs, unknown faces, and AI integration.
 */

import { Router } from 'express';
import * as recognitionController from '../controllers/recognition.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const router = Router();

router.use(authenticate);

router.get('/logs', recognitionController.getLogs);
router.get('/unknown', recognitionController.getUnknownFaces);
router.get('/analytics', recognitionController.getAnalytics);
router.delete('/logs/:id', requireRole('admin', 'station'), recognitionController.removeLog);

// AI integration endpoints
router.post('/recognize', requireRole('admin'), recognitionController.recognize);
router.post('/register-face', requireRole('admin'), recognitionController.registerFace);

export default router;
