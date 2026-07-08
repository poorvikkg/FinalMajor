/**
 * index.ts (routes)
 * Aggregates all route modules into a single router.
 * This is the only file imported by app.ts.
 */

import { Router } from 'express';
import authRoutes from './auth.routes';
import cameraRoutes from './camera.routes';
import videoRoutes from './video.routes';
import recognitionRoutes from './recognition.routes';
import complaintRoutes from './complaint.routes';
import dashboardRoutes from './dashboard.routes';
import userRoutes from './user.routes';
import notificationRoutes from './notification.routes';

const router = Router();

// Mount each route module at its API prefix
router.use('/auth', authRoutes);
router.use('/cameras', cameraRoutes);
router.use('/videos', videoRoutes);
router.use('/recognition', recognitionRoutes);
router.use('/complaints', complaintRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);
router.use('/notifications', notificationRoutes);

export default router;
