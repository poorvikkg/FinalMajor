import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', notificationController.getList);
router.put('/read-all', notificationController.readAll);
router.put('/:id/read', notificationController.readOne);

export default router;
