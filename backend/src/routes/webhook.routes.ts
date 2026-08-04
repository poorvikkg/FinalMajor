/**
 * webhook.routes.ts
 *
 * Internal endpoints meant ONLY to be called by the AI Python microservice.
 * Do not expose these to the frontend or public internet.
 */

import { Router } from 'express';
import { handleAiRecognitionWebhook, handleUnknownStatusChangeWebhook, handleSuspectSightingWebhook } from '../controllers/webhook.controller';

const router = Router();

// Endpoint for the AI service to push live match & unknown detection alerts
router.post('/recognitions', handleAiRecognitionWebhook);

// Endpoint for the AI service to push status change events (UNKNOWN → RECURRING → REVIEW_REQUIRED)
router.post('/unknown-status-change', handleUnknownStatusChangeWebhook);

// Endpoint for the AI service when an ALERTED camera confirms suspect detection (triggers relay hop)
router.post('/suspect-sighting', handleSuspectSightingWebhook);

export default router;
