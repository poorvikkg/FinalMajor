/**
 * db.ts
 * Connects to MongoDB using Mongoose.
 * Uses connection pooling (default: 5 connections).
 * Logs connection status and crashes on failure.
 */

import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.mongoUri, {
      // Mongoose 8+ has sensible defaults, but let's be explicit
      maxPoolSize: 10, // max concurrent connections
    });
    logger.info('✅ MongoDB connected successfully');

    // Seed default admin user if not present
    const { User } = await import('../models/User');
    const adminExists = await User.findOne({ email: 'admin@123' });
    if (!adminExists) {
      await User.create({
        name: 'Administrator',
        email: 'admin@123',
        password: 'admin123',
        role: 'admin',
        isActive: true,
      });
      logger.info('👤 Seeded default admin account: admin@123 / admin123');
    }
  } catch (error) {
    logger.error({ error }, '❌ MongoDB connection failed');
    process.exit(1); // crash the app — cannot run without DB
  }
}

// Log when mongoose disconnects (e.g. during shutdown)
mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ MongoDB disconnected');
});
