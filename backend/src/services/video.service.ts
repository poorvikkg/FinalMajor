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
export async function processVideo(videoId: string, targetUserId?: string) {
  const video = await videoRepo.findVideoById(videoId);
  if (!video) throw new AppError('Video not found', 404);

  // Update status to processing
  await videoRepo.updateVideoStatus(videoId, 'processing');

  try {
    const formData = new FormData();
    formData.append('video', fs.createReadStream(video.path), { filename: video.originalName });
    if (targetUserId) {
      formData.append('target_user_id', targetUserId);
    }
    if (video.cameraId) {
      formData.append('camera_id', video.cameraId.toString());
    }

    // Process the video using the Python AI microservice (synchronously for now)
    const aiResponse = await axios.post('http://127.0.0.1:8000/videos/process', formData, {
      headers: {
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    const aiData = aiResponse.data;

    // Save recognition logs (deduplicated per user_id to avoid one entry per frame)
    const timeline = aiData.timeline || [];
    const seenUserIds = new Set<string>();

    for (const log of timeline) {
      // Only store confirmed matches — skip unknowns
      if (log.is_unknown || log.user_id === 'unknown') continue;

      // Deduplicate: only log the first occurrence of each matched person
      const dedupeKey = log.user_id;
      if (seenUserIds.has(dedupeKey)) continue;
      seenUserIds.add(dedupeKey);

      let resolvedPersonName: string | undefined;
      try {
        const complaint = await complaintRepo.findComplaintById(log.user_id);
        resolvedPersonName = complaint?.missingPersonName || `Subject ${log.user_id.substring(0, 6)}`;
      } catch {
        resolvedPersonName = `Subject ${log.user_id.substring(0, 6)}`;
      }

      await logRecognition({
        personName: resolvedPersonName,
        isUnknown: log.is_unknown,
        confidence: log.confidence,
        cameraId: video.cameraId ? video.cameraId.toString() : undefined,
        videoId: videoId,
        snapshot: log.snapshot_path || undefined,  // e.g. 'snapshots/snap_xxx.jpg' → served as /uploads/snapshots/snap_xxx.jpg
      });
    }

    await videoRepo.updateVideoStatus(videoId, 'completed');
    return { message: 'Video processing completed', videoId, data: aiData };
  } catch (error: any) {
    console.error('AI Service Error:', error.response?.data || error.message);
    await videoRepo.updateVideoStatus(videoId, 'failed');
    throw new AppError('AI processing failed', 500);
  }
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
