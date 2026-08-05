/**
 * zone.controller.ts
 * REST controllers for geofence zone management.
 */

import { Request, Response, NextFunction } from 'express';
import * as zoneService from '../services/zone.service';
import { AppError } from '../middlewares/error.middleware';
import { AuthRequest } from '../types';

/** GET /zones */
export async function listZones(req: Request, res: Response, next: NextFunction) {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const zones = await zoneService.getAllZones(activeOnly);
    res.json({ success: true, data: zones });
  } catch (err) {
    next(err);
  }
}

/** POST /zones */
export async function createZone(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, description, type, color, coordinates, centerLat, centerLng } = req.body;

    if (!name || !coordinates || centerLat === undefined || centerLng === undefined) {
      throw new AppError('name, coordinates, centerLat, and centerLng are required', 400);
    }

    const userId = req.user!._id.toString();
    const zone = await zoneService.createZone({
      name,
      description,
      type: type || 'WATCH',
      color,
      coordinates,
      centerLat,
      centerLng,
      userId,
    });

    res.status(201).json({ success: true, data: zone });
  } catch (err) {
    next(err);
  }
}

/** DELETE /zones/:zoneId */
export async function deleteZone(req: Request, res: Response, next: NextFunction) {
  try {
    const { zoneId } = req.params;
    const deleted = await zoneService.deleteZone(zoneId);
    if (!deleted) throw new AppError('Zone not found', 404);
    res.json({ success: true, message: 'Zone deleted' });
  } catch (err) {
    next(err);
  }
}

/** PATCH /zones/:zoneId/toggle */
export async function toggleZone(req: Request, res: Response, next: NextFunction) {
  try {
    const { zoneId } = req.params;
    const zone = await zoneService.toggleZone(zoneId);
    if (!zone) throw new AppError('Zone not found', 404);
    res.json({ success: true, data: zone });
  } catch (err) {
    next(err);
  }
}

/** POST /zones/:zoneId/trigger-scan */
export async function triggerZoneScan(req: Request, res: Response, next: NextFunction) {
  try {
    const { zoneId } = req.params;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      throw new AppError('targetUserId is required', 400);
    }

    const result = await zoneService.triggerZoneScan(zoneId, targetUserId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/** POST /zones/:zoneId/stop-scan */
export async function stopZoneScan(req: Request, res: Response, next: NextFunction) {
  try {
    const { zoneId } = req.params;
    const result = await zoneService.stopZoneScan(zoneId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
