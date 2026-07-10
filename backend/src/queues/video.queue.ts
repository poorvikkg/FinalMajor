import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import * as videoRepo from '../repositories/video.repository';
import * as complaintRepo from '../repositories/complaint.repository';
import { logRecognition } from '../services/recognition.service';
import { env } from '../config/env';
import dotenv from 'dotenv';
dotenv.config();

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
});

export const videoQueue = new Queue('video-processing', { connection: connection as any });

const worker = new Worker('video-processing', async (job: Job) => {
  const { videoId, targetUserId } = job.data;
  console.log(`[BullMQ] Starting job for video ${videoId}`);

  const video = await videoRepo.findVideoById(videoId);
  if (!video) throw new Error('Video not found');

  try {
    const formData = new FormData();
    formData.append('video', fs.createReadStream(video.path), { filename: video.originalName });
    if (targetUserId) {
      formData.append('target_user_id', targetUserId);
    }
    if (video.cameraId) {
      formData.append('camera_id', video.cameraId.toString());
    }

    // Process the video using the Python AI microservice
    const aiResponse = await axios.post(`${env.aiServiceUrl}/videos/process`, formData, {
      headers: { ...formData.getHeaders() },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    const aiData = aiResponse.data;

    // Save recognition logs (deduplicated per user_id)
    const timeline = aiData.timeline || [];
    const seenUserIds = new Set<string>();

    for (const log of timeline) {
      const dedupeKey = log.is_unknown || log.user_id === 'unknown' ? `unknown_${Math.round(log.confidence * 10)}` : log.user_id;
      if (seenUserIds.has(dedupeKey)) continue;
      seenUserIds.add(dedupeKey);

      let resolvedPersonName: string | undefined;
      if (!log.is_unknown && log.user_id !== 'unknown') {
        try {
          const complaint = await complaintRepo.findComplaintById(log.user_id);
          resolvedPersonName = complaint?.missingPersonName || `Subject ${log.user_id.substring(0, 6)}`;
        } catch {
          resolvedPersonName = `Subject ${log.user_id.substring(0, 6)}`;
        }
      }

      await logRecognition({
        personName: resolvedPersonName,
        isUnknown: log.is_unknown || log.user_id === 'unknown',
        confidence: log.confidence,
        cameraId: video.cameraId ? video.cameraId.toString() : undefined,
        videoId: videoId,
        snapshot: log.snapshot_path || undefined,
      });
    }

    await videoRepo.updateVideoStatus(videoId, 'completed');
    console.log(`[BullMQ] Finished processing video ${videoId}`);
    return { success: true, aiData };
  } catch (error: any) {
    console.error(`[BullMQ] Failed to process video ${videoId}:`, error.response?.data || error.message);
    await videoRepo.updateVideoStatus(videoId, 'failed');
    throw error;
  }
}, { connection: connection as any });

worker.on('failed', (job, err) => {
  console.error(`[BullMQ] Job ${job?.id} failed:`, err);
});
