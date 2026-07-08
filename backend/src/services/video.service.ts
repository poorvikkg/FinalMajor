/**
 * video.service.ts
 * Business logic for video upload and processing status.
 */

import path from 'path';
import fs from 'fs';
import { AppError } from '../middlewares/error.middleware';
import * as videoRepo from '../repositories/video.repository';
import { Types } from 'mongoose';

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

// AI Integration Point: queues a video for processing
export async function processVideo(videoId: string) {
  const video = await videoRepo.findVideoById(videoId);
  if (!video) throw new AppError('Video not found', 404);

  // Update status to queued
  await videoRepo.updateVideoStatus(videoId, 'queued');

  // TODO: Send request to Python AI service:
  // POST http://ai-service/api/videos/process
  // Body: { videoId, filePath: video.path }
  //
  // The AI service will call back via a webhook or update the DB directly
  // when it finishes, changing status to 'completed' or 'failed'.

  return { message: 'Video queued for processing', videoId };
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
