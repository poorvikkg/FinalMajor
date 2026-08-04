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

function normalizeCameraLocation(location: any) {
  if (!location) {
    return { name: 'Unknown Location', latitude: 0, longitude: 0, locationGeoJson: { type: 'Point', coordinates: [0, 0] } };
  }
  if (typeof location === 'string') {
    return { name: location, latitude: 0, longitude: 0, locationGeoJson: { type: 'Point', coordinates: [0, 0] } };
  }
  const name = location.name || 'Unknown Location';
  const lat = typeof location.latitude === 'number' ? location.latitude : 0;
  const lng = typeof location.longitude === 'number' ? location.longitude : 0;
  return {
    name,
    latitude: lat,
    longitude: lng,
    locationGeoJson: {
      type: 'Point',
      coordinates: [lng, lat], // GeoJSON format: [longitude, latitude] !!
    },
  };
}

export async function createCamera(input: CreateCameraInput, userId: Types.ObjectId) {
  const normalizedInput = {
    ...input,
    location: normalizeCameraLocation(input.location),
    addedBy: userId,
  };
  return cameraRepo.createCamera(normalizedInput as any);
}

export async function updateCamera(id: string, input: UpdateCameraInput) {
  const updateData: any = { ...input };
  if (input.location) {
    updateData.location = normalizeCameraLocation(input.location);
  }
  const camera = await cameraRepo.updateCamera(id, updateData);
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

function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function triggerCorridorCameras(
  points: { latitude: number; longitude: number }[],
  radiusMeters = 2000,
  targetUserId?: string
) {
  if (!points || points.length === 0) {
    throw new AppError('No trajectory points provided', 400);
  }

  const { cameras } = await cameraRepo.findAllCameras({ page: 1, limit: 1000, skip: 0 });

  const triggeredCameras: any[] = [];
  const errors: string[] = [];

  for (const camera of cameras) {
    const loc = typeof camera.location === 'object' ? camera.location as any : null;
    const camLat = loc?.latitude;
    const camLng = loc?.longitude;
    if (typeof camLat !== 'number' || typeof camLng !== 'number' || (camLat === 0 && camLng === 0)) {
      continue;
    }

    let isNearPath = false;
    for (const pt of points) {
      const dist = calculateHaversineDistance(camLat, camLng, pt.latitude, pt.longitude);
      if (dist <= radiusMeters) {
        isNearPath = true;
        break;
      }
    }

    if (isNearPath) {
      try {
        const updated = await startCamera(camera._id.toString(), 'target', targetUserId);
        triggeredCameras.push(updated);
      } catch (err: any) {
        errors.push(`Camera ${camera.name || camera._id}: ${err.message}`);
      }
    }
  }

  return {
    triggeredCount: triggeredCameras.length,
    triggeredCameras,
    errors,
  };
}
