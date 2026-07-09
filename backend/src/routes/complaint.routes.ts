/**
 * complaint.routes.ts
 * Routes for missing person complaint submission and case management.
 */

import { Router } from 'express';
import * as complaintController from '../controllers/complaint.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createComplaintSchema,
  updateComplaintStatusSchema,
  updateComplaintSchema,
} from '../validators/complaint.validator';
import { uploadAttachment } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

router.get('/', complaintController.getAll);
router.get('/stats', complaintController.getStats);
router.get('/:id', complaintController.getOne);
router.get('/:id/history', complaintController.getHistory);

// Any authenticated user can submit a complaint
router.post(
  '/',
  uploadAttachment.array('attachments', 10),
  validate(createComplaintSchema),
  complaintController.create
);

// Operators/admins update case status (dedicated endpoint with evidence upload)
router.put(
  '/:id/status',
  requireRole('admin', 'operator'),
  uploadAttachment.array('evidenceImages', 10),
  validate(updateComplaintStatusSchema),
  complaintController.updateStatus
);

// Admin legacy update (direct field overrides)
router.put('/:id', requireRole('admin', 'operator'), validate(updateComplaintSchema), complaintController.update);
router.delete('/:id', requireRole('admin'), complaintController.remove);

export default router;
