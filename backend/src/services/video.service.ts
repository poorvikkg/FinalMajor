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

// Called after Multer saves the file to disk
export async function saveUploadedVideo(
  file: Express.Multer.File,
  userId: Types.ObjectId,
  cameraId?: string
) {
  return videoRepo.createVideo({
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path,
    uploadedBy: userId,
    cameraId: cameraId ? new Types.ObjectId(cameraId) : undefined,
    status: 'uploaded',
  });
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
