/**
 * accomplice.controller.ts
 *
 * REST API controller for the Accomplice Detection / Link Analysis Engine.
 */

import { Request, Response, NextFunction } from 'express';
import * as accompliceService from '../services/accomplice.service';

export async function getLinkAnalysis(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const timeWindowSeconds = req.query.timeWindowSeconds
      ? parseInt(req.query.timeWindowSeconds as string, 10)
      : undefined;
    const distanceThresholdMeters = req.query.distanceThresholdMeters
      ? parseInt(req.query.distanceThresholdMeters as string, 10)
      : undefined;
    const minCoOccurrences = req.query.minCoOccurrences
      ? parseInt(req.query.minCoOccurrences as string, 10)
      : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const targetId = req.query.targetId as string | undefined;

    const result = await accompliceService.getLinkAnalysis({
      timeWindowSeconds,
      distanceThresholdMeters,
      minCoOccurrences,
      startDate,
      endDate,
      targetId,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
