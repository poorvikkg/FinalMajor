/**
 * sighting.controller.ts
 *
 * REST API controller for Sighting Map & Location Tracking.
 */

import { Request, Response, NextFunction } from 'express';
import * as sightingService from '../services/sighting.service';
import { sendSuccess, sendPaginated } from '../utils/response';

export async function getSightings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const north = req.query.north ? parseFloat(req.query.north as string) : undefined;
    const south = req.query.south ? parseFloat(req.query.south as string) : undefined;
    const east = req.query.east ? parseFloat(req.query.east as string) : undefined;
    const west = req.query.west ? parseFloat(req.query.west as string) : undefined;

    const filters: sightingService.SightingFilterOptions = {
      personId: req.query.personId as string,
      unknownPersonId: req.query.unknownPersonId as string,
      cameraId: req.query.cameraId as string,
      videoId: req.query.videoId as string,
      identityType: req.query.identityType as any,
      sourceType: req.query.sourceType as any,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      sortOrder: (req.query.sortOrder as any) || 'desc',
      north,
      south,
      east,
      west,
    };

    const { sightings, total } = await sightingService.getSightings(page, limit, filters);

    sendPaginated(res, 'Sightings retrieved successfully', sightings, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function getSightingById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sighting = await sightingService.getSightingById(req.params.id);
    if (!sighting) {
      res.status(404).json({ success: false, message: 'Sighting record not found' });
      return;
    }
    sendSuccess(res, 'Sighting retrieved', sighting);
  } catch (error) {
    next(error);
  }
}

export async function getPersonSightings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sightings = await sightingService.getSightingsByPerson(req.params.personId);
    sendSuccess(res, 'Person sighting timeline retrieved', sightings);
  } catch (error) {
    next(error);
  }
}

export async function getUnknownPersonSightings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sightings = await sightingService.getSightingsByUnknownPerson(req.params.unknownId);
    sendSuccess(res, 'Unknown person sighting timeline retrieved', sightings);
  } catch (error) {
    next(error);
  }
}
