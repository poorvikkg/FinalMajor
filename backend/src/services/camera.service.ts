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

// AI Integration Point: will communicate with Python FastAPI later
export async function startCamera(id: string) {
  const camera = await cameraRepo.findCameraById(id);
  if (!camera) throw new AppError('Camera not found', 404);

  // TODO: POST to Python AI service: http://ai-service/api/cameras/start
  // For now, just update status to online
  return cameraRepo.updateCamera(id, { status: 'online', lastActive: new Date() });
}

// AI Integration Point
export async function stopCamera(id: string) {
  const camera = await cameraRepo.findCameraById(id);
  if (!camera) throw new AppError('Camera not found', 404);

  // TODO: POST to Python AI service: http://ai-service/api/cameras/stop
  return cameraRepo.updateCamera(id, { status: 'offline' });
}
