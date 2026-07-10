import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const router = Router();

router.use(authenticate);

// Only admins can generate and send PDF reports
router.post('/send', requireRole('admin'), reportController.sendReport);

export default router;
