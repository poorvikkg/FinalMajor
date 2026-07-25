/**
 * sighting.routes.ts
 *
 * REST API routes for Sighting Map & Location Tracking.
 */

import { Router } from 'express';
import * as sightingController from '../controllers/sighting.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// List & search sightings (supports bbox: north, south, east, west, dates, identity types)
router.get('/', sightingController.getSightings);

// Individual sighting details
router.get('/:id', sightingController.getSightingById);

// Timelines
router.get('/person/:personId', sightingController.getPersonSightings);
router.get('/unknown/:unknownId', sightingController.getUnknownPersonSightings);

export default router;
