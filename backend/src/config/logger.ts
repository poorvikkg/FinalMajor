/**
 * logger.ts
 * Creates a Pino logger instance.
 * In development mode, uses pino-pretty for human-readable output.
 * In production, outputs structured JSON for log aggregators.
 */

import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.isDev ? 'debug' : 'info',
  transport: env.isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});
