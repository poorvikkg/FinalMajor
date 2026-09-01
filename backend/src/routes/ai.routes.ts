/**
 * ai.routes.ts
 * Routes for AI RAG Intelligence, case summaries, and natural language crime queries.
 */

import { Router } from 'express';
import * as aiController from '../controllers/ai.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/query', aiController.query);
router.post('/chat', aiController.chat);
router.post('/similar', aiController.similar);
router.post('/summarize', aiController.summarize);

export default router;
