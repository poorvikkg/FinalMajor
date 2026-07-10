/**
 * app.ts
 * Express application setup.
 * Configures middleware stack (security, logging, parsing, routes, error handling).
 * Kept separate from server.ts so it can be imported for testing.
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { env } from './config/env';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';

const app: Application = express();

// ── Security ────────────────────────────────────────────
// Helmet sets security HTTP headers (XSS protection, HSTS, etc.)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS: allow requests only from the frontend URL
app.use(cors({ origin: env.corsOrigin, credentials: true }));

// Rate limiting: prevents brute-force and DDoS attacks
const limiter = rateLimit({
  windowMs: env.rateLimitWindowMs, // 15 minutes
  max: env.rateLimitMax,            // 100 requests per window
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// ── Performance ──────────────────────────────────────────
// Compress response bodies to reduce bandwidth
app.use(compression());

// ── Parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static Files ─────────────────────────────────────────
// Serve uploaded files (videos, snapshots) as static assets
app.use('/uploads', express.static(path.resolve(env.uploadDir)));

// ── Routes ───────────────────────────────────────────────
app.use('/api', routes);

// Health check endpoint (useful for load balancers and monitoring)
app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running', env: env.nodeEnv });
});

// 404 handler for unknown routes
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Error Handler ─────────────────────────────────────────
// This MUST be the last middleware — catches all errors from above
app.use(errorHandler);

export default app;
