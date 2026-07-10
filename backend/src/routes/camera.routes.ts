/**
 * camera.routes.ts
 * Routes for camera CRUD and AI control (start/stop).
 */

import { Router } from 'express';
import * as cameraController from '../controllers/camera.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createCameraSchema, updateCameraSchema } from '../validators/camera.validator';

const router = Router();

// All camera routes require authentication
router.use(authenticate);

router.get('/', cameraController.getAll);
router.get('/:id', cameraController.getOne);

// Only admin can add/edit/delete cameras
router.post('/', requireRole('admin'), validate(createCameraSchema), cameraController.create);
router.put('/:id', requireRole('admin'), validate(updateCameraSchema), cameraController.update);
router.delete('/:id', requireRole('admin'), cameraController.remove);

// AI integration endpoints
router.post('/:id/start', requireRole('admin'), cameraController.startCamera);
router.post('/:id/stop', requireRole('admin'), cameraController.stopCamera);

export default router;
