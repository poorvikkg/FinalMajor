/**
 * unknownPerson.routes.ts
 *
 * REST API routes for Recurring Unknown Person Detection & Human Review.
 */

import { Router } from 'express';
import * as unknownPersonController from '../controllers/unknownPerson.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const router = Router();

router.use(authenticate);

// Listing & details
router.get('/', unknownPersonController.getUnknownPersons);
router.get('/stats', unknownPersonController.getStats);
router.get('/recurring', unknownPersonController.getRecurring);
router.get('/review-required', unknownPersonController.getReviewRequired);
router.get('/:unknownId', unknownPersonController.getUnknownPersonById);
router.get('/:unknownId/appearances', unknownPersonController.getAppearances);

// Human review workflow (Admin & Station officers)
router.post(
  '/:unknownId/review',
  requireRole('admin', 'station'),
  unknownPersonController.markReviewed
);

export default router;
