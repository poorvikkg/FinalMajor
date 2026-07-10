/**
 * video.routes.ts
 * Routes for video upload, listing, and processing.
 */

import { Router } from 'express';
import * as videoController from '../controllers/video.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { uploadVideo } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);



router.get('/', videoController.getAll);
router.get('/:id', videoController.getOne);

// Operators and admins can upload videos
router.post('/upload', requireRole('admin'), uploadVideo.single('video'), videoController.upload);

// One-shot: upload + immediately queue for face recognition analysis
router.post('/analyse', requireRole('admin', 'station'), uploadVideo.single('video'), videoController.analyseVideo);

// AI integration: queue a video for processing
router.post('/process', requireRole('admin', 'station'), videoController.processVideo);

router.delete('/:id', requireRole('admin'), videoController.remove);

export default router;
