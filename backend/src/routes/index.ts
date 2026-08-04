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
import reportRoutes from './report.routes';
import webhookRoutes from './webhook.routes';
import unknownPersonRoutes from './unknownPerson.routes';
import sightingRoutes from './sighting.routes';
import suspectAlertRoutes from './suspectAlert.routes';
import analyticsRoutes from './analytics.routes';
import zoneRoutes from './zone.routes';

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
router.use('/reports', reportRoutes);

// Internal webhooks (from AI service)
router.use('/webhooks', webhookRoutes);

// Recurring unknown person management
router.use('/unknown-persons', unknownPersonRoutes);

// Sighting Map & Location Tracking
router.use('/sightings', sightingRoutes);

// Suspect Relay Chase Network
router.use('/suspect-alerts', suspectAlertRoutes);

// AI Threat Intelligence & Analytics
router.use('/analytics', analyticsRoutes);

// Geofence Zones
router.use('/zones', zoneRoutes);

export default router;
