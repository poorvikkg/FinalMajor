/**
 * complaint.routes.ts
 * Routes for complaint submission and management.
 */

import { Router } from 'express';
import * as complaintController from '../controllers/complaint.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createComplaintSchema, updateComplaintSchema } from '../validators/complaint.validator';
import { uploadAttachment } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

router.get('/', complaintController.getAll);
router.get('/stats', complaintController.getStats);
router.get('/:id', complaintController.getOne);

// Any authenticated user can submit a complaint
router.post(
  '/',
  uploadAttachment.array('attachments', 10),
  validate(createComplaintSchema),
  complaintController.create
);

// Only admins and operators can update complaints
router.put('/:id', requireRole('admin', 'operator'), validate(updateComplaintSchema), complaintController.update);
router.delete('/:id', requireRole('admin'), complaintController.remove);

export default router;
