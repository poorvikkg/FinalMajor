/**
 * socket.ts
 * Sets up Socket.IO and registers all event handlers.
 * Real-time features: camera status updates, unknown face alerts, live detection events.
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../config/logger';

let io: SocketIOServer;

export function initializeSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Socket client connected');

    // Client can join a camera-specific room to receive that camera's events
    socket.on('join-camera', (cameraId: string) => {
      socket.join(`camera:${cameraId}`);
      logger.debug({ cameraId }, 'Socket joined camera room');
    });

    socket.on('leave-camera', (cameraId: string) => {
      socket.leave(`camera:${cameraId}`);
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'Socket client disconnected');
    });
  });

  return io;
}

// Emit a detection event to everyone watching a specific camera
export function emitDetectionEvent(cameraId: string, data: object): void {
  if (io) {
    io.to(`camera:${cameraId}`).emit('detection', data);
  }
}

// Broadcast an unknown face alert to all connected clients
export function emitUnknownFaceAlert(data: object): void {
  if (io) {
    io.emit('unknown-face-alert', data);
  }
}

// Broadcast camera status change
export function emitCameraStatus(cameraId: string, status: string): void {
  if (io) {
    io.emit('camera-status', { cameraId, status });
  }
}

export { io };
