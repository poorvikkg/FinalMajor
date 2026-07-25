/**
 * video.service.ts
 * Business logic for video upload and processing status.
 */

import path from 'path';
import fs from 'fs';
import { AppError } from '../middlewares/error.middleware';
import * as videoRepo from '../repositories/video.repository';
import { Types } from 'mongoose';
import axios from 'axios';
import FormData from 'form-data';
import { logRecognition } from './recognition.service';
import * as complaintRepo from '../repositories/complaint.repository';
import { videoQueue } from '../queues/video.queue';

export async function getAllVideos(page: number, limit: number, status?: string) {
  const filter = status ? { status } : {};
  return videoRepo.findAllVideos({ page, limit, skip: (page - 1) * limit }, filter);
}

export async function getVideoById(id: string) {
  const video = await videoRepo.findVideoById(id);
  if (!video) throw new AppError('Video not found', 404);
  return video;
}

import { findCameraById } from '../repositories/camera.repository';

// Called after Multer saves the file to disk
export async function saveUploadedVideo(
  file: Express.Multer.File,
  userId: Types.ObjectId,
  options: {
    sourceType?: 'REGISTERED_CCTV' | 'OTHER_LOCATION';
    cameraId?: string;
    locationName?: string;
    latitude?: number;
    longitude?: number;
    recordedAt?: Date | string;
  } = {}
) {
  let locationData: { name: string; latitude: number; longitude: number } | undefined = undefined;
  let camId: Types.ObjectId | undefined = undefined;

  if (options.cameraId) {
    camId = new Types.ObjectId(options.cameraId);
  }

  if (options.sourceType === 'REGISTERED_CCTV' && options.cameraId) {
    const camera = await findCameraById(options.cameraId);
    if (camera && camera.location) {
      if (typeof camera.location === 'object') {
        locationData = {
          name: camera.location.name || camera.name,
          latitude: camera.location.latitude || 0,
          longitude: camera.location.longitude || 0,
        };
      } else {
        locationData = {
          name: camera.location || camera.name,
          latitude: 0,
          longitude: 0,
        };
      }
    }
  } else if (options.locationName || options.latitude !== undefined) {
    locationData = {
      name: options.locationName || 'Uploaded Video Location',
      latitude: options.latitude ?? 0,
      longitude: options.longitude ?? 0,
    };
  }

  const recordedAtDate = options.recordedAt ? new Date(options.recordedAt) : new Date();

  return videoRepo.createVideo({
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path,
    uploadedBy: userId,
    cameraId: camId,
    sourceType: options.sourceType || (options.cameraId ? 'REGISTERED_CCTV' : 'OTHER_LOCATION'),
    location: locationData,
    recordedAt: recordedAtDate,
    status: 'uploaded',
  } as any);
}

export async function processVideo(videoId: string, targetUserId?: string) {
  const video = await videoRepo.findVideoById(videoId);
  if (!video) throw new AppError('Video not found', 404);

  // Update status to processing
  await videoRepo.updateVideoStatus(videoId, 'processing');

  // Push the job to BullMQ
  await videoQueue.add('process-video', {
    videoId,
    targetUserId
  });

  return { message: 'Video queued in BullMQ for background processing', videoId };
}

export async function deleteVideo(id: string) {
  const video = await videoRepo.findVideoById(id);
  if (!video) throw new AppError('Video not found', 404);

  // Delete the physical file from disk
  if (fs.existsSync(video.path)) {
    fs.unlinkSync(video.path);
  }

  return videoRepo.deleteVideo(id);
}
