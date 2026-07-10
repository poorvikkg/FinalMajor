/**
 * video.controller.ts
 * Handles HTTP requests for video upload and management.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as videoService from '../services/video.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { getPaginationOptions, buildPaginationMeta } from '../utils/pagination';
import { AppError } from '../middlewares/error.middleware';

export async function getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = getPaginationOptions(req);
    const status = req.query.status as string | undefined;
    const { videos, total } = await videoService.getAllVideos(page, limit, status);
    sendPaginated(res, 'Videos retrieved', videos, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const video = await videoService.getVideoById(req.params.id);
    sendSuccess(res, 'Video retrieved', video);
  } catch (err) {
    next(err);
  }
}

export async function upload(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) throw new AppError('No video file uploaded', 400);

    const video = await videoService.saveUploadedVideo(
      req.file,
      req.user!._id,
      req.body.cameraId
    );
    sendSuccess(res, 'Video uploaded successfully', video, 201);
  } catch (err) {
    next(err);
  }
}

export async function processVideo(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { videoId, targetUserId } = req.body;
    const result = await videoService.processVideo(videoId, targetUserId);
    sendSuccess(res, 'Video queued for processing', result);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await videoService.deleteVideo(req.params.id);
    sendSuccess(res, 'Video deleted successfully');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /videos/analyse
 * One-shot: upload a video file and immediately queue it for face recognition.
 * Returns the video record with status=queued so the client can poll for results.
 */
export async function analyseVideo(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) throw new AppError('No video file provided', 400);

    // Save the video record
    const video = await videoService.saveUploadedVideo(
      req.file,
      req.user!._id,
      req.body.cameraId
    );

    // Immediately queue it for processing
    const targetUserId = req.body.targetUserId;
    await videoService.processVideo((video._id as any).toString(), targetUserId);

    sendSuccess(res, 'Video uploaded and queued for analysis', video, 201);
  } catch (err) {
    next(err);
  }
}

