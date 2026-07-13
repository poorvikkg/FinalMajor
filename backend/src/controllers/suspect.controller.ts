/**
 * suspect.controller.ts
 *
 * Exposes API endpoints for managing Suspects.
 */

import { Request, Response, NextFunction } from 'express';
import * as suspectService from '../services/suspect.service';
import { sendSuccess, sendPaginated } from '../utils/response';

export async function getSuspects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const flagged = req.query.flagged === 'true';

    const { suspects, total } = await suspectService.getAllSuspects(page, limit, flagged);

    sendPaginated(res, 'Suspects retrieved', suspects, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function getSuspectById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const suspect = await suspectService.getSuspectById(req.params.id);
    if (!suspect) {
      res.status(404).json({ success: false, message: 'Suspect not found' });
      return;
    }
    sendSuccess(res, 'Suspect retrieved', suspect);
  } catch (error) {
    next(error);
  }
}

export async function resolveSuspect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const suspect = await suspectService.resolveSuspect(req.params.id, req.body.notes);
    if (!suspect) {
      res.status(404).json({ success: false, message: 'Suspect not found' });
      return;
    }
    sendSuccess(res, 'Suspect resolved', suspect);
  } catch (error) {
    next(error);
  }
}

export async function updateNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const suspect = await suspectService.updateSuspectNotes(req.params.id, req.body.notes);
    if (!suspect) {
      res.status(404).json({ success: false, message: 'Suspect not found' });
      return;
    }
    sendSuccess(res, 'Suspect notes updated', suspect);
  } catch (error) {
    next(error);
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await suspectService.getSuspectStats();
    sendSuccess(res, 'Suspect stats retrieved', stats);
  } catch (error) {
    next(error);
  }
}
