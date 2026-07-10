/**
 * recognition.controller.ts
 * Handles HTTP requests for recognition logs and unknown faces.
 * Also exposes AI integration endpoints (stubs for now).
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as recognitionService from '../services/recognition.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { getPaginationOptions, buildPaginationMeta } from '../utils/pagination';

export async function getLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = getPaginationOptions(req);
    const cameraId = req.query.cameraId as string | undefined;
    const videoId = req.query.videoId as string | undefined;
    const personName = req.query.personName as string | undefined;
    const { logs, total } = await recognitionService.getLogs(page, limit, cameraId, videoId, personName);
    sendPaginated(res, 'Recognition logs retrieved', logs, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
}

export async function getUnknownFaces(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { page, limit } = getPaginationOptions(req);
    const { faces, total } = await recognitionService.getUnknownFaces(page, limit);
    sendPaginated(res, 'Unknown faces retrieved', faces, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
}

export async function getAnalytics(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const data = await recognitionService.getDetectionsByDay(days);
    sendSuccess(res, 'Analytics data retrieved', data);
  } catch (err) {
    next(err);
  }
}

// AI Integration Point — called by the Python AI service
export async function recognize(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await recognitionService.recognize(req.body.image);
    sendSuccess(res, 'Recognition result', result);
  } catch (err) {
    next(err);
  }
}

// AI Integration Point — register a new face
export async function registerFace(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await recognitionService.registerFace(req.body);
    sendSuccess(res, 'Face registration queued', result);
  } catch (err) {
    next(err);
  }
}
