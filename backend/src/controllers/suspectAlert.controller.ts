/**
 * suspectAlert.controller.ts
 * REST controllers for the Suspect Relay Alert API.
 */

import { Request, Response, NextFunction } from 'express';
import * as relayService from '../services/suspectRelay.service';
import { AppError } from '../middlewares/error.middleware';

/** GET /suspect-alerts */
export async function listAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;

    const result = await relayService.getAlerts(page, limit, status);
    res.json({
      success: true,
      data: result.alerts,
      pagination: { page, limit, total: result.total },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /suspect-alerts/:alertId */
export async function getAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const { alertId } = req.params;
    const alert = await relayService.getAlertById(alertId);
    if (!alert) throw new AppError('Alert not found', 404);
    res.json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
}

/** POST /suspect-alerts/:alertId/resolve */
export async function resolveAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const { alertId } = req.params;
    const reason = req.body.reason || 'Manual resolution by operator';
    const resolved = await relayService.resolveAlert(alertId, reason);
    if (!resolved) throw new AppError('Alert not found or already resolved', 404);
    res.json({ success: true, data: resolved });
  } catch (err) {
    next(err);
  }
}

/** GET /suspect-alerts/:alertId/trail */
export async function getAlertTrail(req: Request, res: Response, next: NextFunction) {
  try {
    const { alertId } = req.params;
    const alert = await relayService.getAlertById(alertId);
    if (!alert) throw new AppError('Alert not found', 404);
    res.json({
      success: true,
      data: {
        alertId: alert.alertId,
        suspectLabel: alert.suspectLabel,
        status: alert.status,
        relayChain: alert.relayChain,
        alertedCameras: alert.alertedCameraIds,
        totalHops: alert.relayChain.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /cameras/:id/alerts */
export async function getCameraAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const alerts = await relayService.getAlertsForCamera(id);
    res.json({ success: true, data: alerts });
  } catch (err) {
    next(err);
  }
}

/** GET /cameras/nearby?lat=&lng=&radius= */
export async function getNearbyCamerasController(req: Request, res: Response, next: NextFunction) {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = parseFloat(req.query.radius as string) || 1000;

    if (isNaN(lat) || isNaN(lng)) {
      throw new AppError('lat and lng query parameters are required', 400);
    }

    const cameras = await relayService.getNearbyCameras(lat, lng, radius);
    res.json({ success: true, data: cameras });
  } catch (err) {
    next(err);
  }
}
