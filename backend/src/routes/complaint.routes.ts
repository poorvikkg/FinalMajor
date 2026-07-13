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

// Admin & Station roles can update status/priority
router.patch('/:id/status', requireRole('admin', 'station'), validate(updateComplaintStatusSchema), complaintController.updateStatus);


router.delete('/:id/attachments', requireRole('admin', 'station'), complaintController.removeAttachment);

// Admin legacy update (direct field overrides)
router.put('/:id', requireRole('admin', 'station'), validate(updateComplaintSchema), complaintController.update);
router.delete('/:id', requireRole('admin', 'station'), complaintController.remove);

export default router;
