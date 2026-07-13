/**
 * camera.service.ts
 * Business logic for camera management.
 */

import { AppError } from '../middlewares/error.middleware';
import * as cameraRepo from '../repositories/camera.repository';
import { CreateCameraInput, UpdateCameraInput } from '../validators/camera.validator';
import { Types } from 'mongoose';

export async function getAllCameras(
  page: number,
  limit: number,
  status?: string
) {
  const filter = status ? { status } : {};
  return cameraRepo.findAllCameras({ page, limit, skip: (page - 1) * limit }, filter);
}

export async function getCameraById(id: string) {
  const camera = await cameraRepo.findCameraById(id);
  if (!camera) throw new AppError('Camera not found', 404);
  return camera;
}

export async function createCamera(input: CreateCameraInput, userId: Types.ObjectId) {
  return cameraRepo.createCamera({ ...input, addedBy: userId });
}

export async function updateCamera(id: string, input: UpdateCameraInput) {
  const camera = await cameraRepo.updateCamera(id, input);
  if (!camera) throw new AppError('Camera not found', 404);
  return camera;
}

export async function deleteCamera(id: string) {
  const camera = await cameraRepo.deleteCamera(id);
  if (!camera) throw new AppError('Camera not found', 404);
  return camera;
}

export async function getCameraStats() {
  return cameraRepo.getCameraStats();
}

import axios from 'axios';
import { env } from '../config/env';

// AI Integration Point: will communicate with Python FastAPI later
export async function startCamera(id: string, mode?: string, targetUserId?: string) {
  const camera = await cameraRepo.findCameraById(id);
  if (!camera) throw new AppError('Camera not found', 404);
  if (!camera.rtspUrl) throw new AppError('Camera does not have an RTSP URL configured', 400);

  try {
    await axios.post(`${env.aiServiceUrl}/streams/start`, {
      camera_id: camera._id.toString(),
      rtsp_url: camera.rtspUrl,
      mode: mode || 'multi_target',
      target_user_id: targetUserId || undefined
    });
  } catch (error: any) {
    console.error('Failed to start AI stream:', error.response?.data || error.message);
    throw new AppError('Failed to start stream in AI service', 500);
  }

  return cameraRepo.updateCamera(id, { status: 'online', lastActive: new Date() });
}

// AI Integration Point
export async function stopCamera(id: string) {
  const camera = await cameraRepo.findCameraById(id);
  if (!camera) throw new AppError('Camera not found', 404);

  try {
    await axios.post(`${env.aiServiceUrl}/streams/stop`, {
      camera_id: camera._id.toString()
    });
  } catch (error: any) {
    console.error('Failed to stop AI stream:', error.response?.data || error.message);
    // Ignore error if it's already stopped
  }

  return cameraRepo.updateCamera(id, { status: 'offline' });
}
