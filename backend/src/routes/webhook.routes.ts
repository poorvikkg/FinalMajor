/**
 * webhook.routes.ts
 *
 * Internal endpoints meant ONLY to be called by the AI Python microservice.
 * Do not expose these to the frontend or public internet.
 */

import { Router } from 'express';
import { handleAiRecognitionWebhook } from '../controllers/webhook.controller';

const router = Router();

// Endpoint for the AI service to push live match & unknown detection alerts
router.post('/recognitions', handleAiRecognitionWebhook);

export default router;
