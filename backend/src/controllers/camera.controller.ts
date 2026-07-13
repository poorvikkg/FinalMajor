/**
 * camera.controller.ts
 * Handles HTTP requests for camera management endpoints.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as cameraService from '../services/camera.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { getPaginationOptions, buildPaginationMeta } from '../utils/pagination';

export async function getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, skip } = getPaginationOptions(req);
    const status = req.query.status as string | undefined;
    const { cameras, total } = await cameraService.getAllCameras(page, limit, status);
    sendPaginated(res, 'Cameras retrieved', cameras, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const camera = await cameraService.getCameraById(req.params.id);
    sendSuccess(res, 'Camera retrieved', camera);
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const camera = await cameraService.createCamera(req.body, req.user!._id);
    sendSuccess(res, 'Camera added successfully', camera, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const camera = await cameraService.updateCamera(req.params.id, req.body);
    sendSuccess(res, 'Camera updated successfully', camera);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await cameraService.deleteCamera(req.params.id);
    sendSuccess(res, 'Camera removed successfully');
  } catch (err) {
    next(err);
  }
}

export async function startCamera(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { mode, target_user_id } = req.body;
    const camera = await cameraService.startCamera(req.params.id, mode, target_user_id);
    sendSuccess(res, 'Camera started', camera);
  } catch (err) {
    next(err);
  }
}

export async function stopCamera(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const camera = await cameraService.stopCamera(req.params.id);
    sendSuccess(res, 'Camera stopped', camera);
  } catch (err) {
    next(err);
  }
}
