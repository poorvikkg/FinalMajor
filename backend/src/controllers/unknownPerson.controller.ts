/**
 * unknownPerson.controller.ts
 *
 * REST API controller for recurring unknown person detection & human review.
 */

import { Request, Response, NextFunction } from 'express';
import * as unknownPersonService from '../services/unknownPerson.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AuthRequest } from '../types';

export async function getUnknownPersons(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const filters: unknownPersonService.UnknownPersonFilter = {
      status: req.query.status as any,
      cameraId: req.query.cameraId as string,
      videoId: req.query.videoId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      isReviewed:
        req.query.isReviewed !== undefined
          ? req.query.isReviewed === 'true'
          : undefined,
    };

    const { unknownPersons, total } =
      await unknownPersonService.getAllUnknownPersons(page, limit, filters);

    sendPaginated(res, 'Unknown persons retrieved', unknownPersons, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function getStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await unknownPersonService.getStats();
    sendSuccess(res, 'Unknown person stats retrieved', stats);
  } catch (error) {
    next(error);
  }
}

export async function getRecurring(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { unknownPersons, total } = await unknownPersonService.getRecurring(
      page,
      limit
    );

    sendPaginated(res, 'Recurring unknown persons retrieved', unknownPersons, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function getReviewRequired(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { unknownPersons, total } =
      await unknownPersonService.getReviewRequired(page, limit);

    sendPaginated(
      res,
      'Review-required unknown persons retrieved',
      unknownPersons,
      {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    );
  } catch (error) {
    next(error);
  }
}

export async function getUnknownPersonById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const unknownPerson = await unknownPersonService.getUnknownPersonById(
      req.params.unknownId
    );

    if (!unknownPerson) {
      res
        .status(404)
        .json({ success: false, message: 'Unknown person identity not found' });
      return;
    }

    sendSuccess(res, 'Unknown person retrieved', unknownPerson);
  } catch (error) {
    next(error);
  }
}

export async function getAppearances(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const { appearances, total } =
      await unknownPersonService.getAppearances(
        req.params.unknownId,
        page,
        limit
      );

    sendPaginated(res, 'Appearances timeline retrieved', appearances, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

export async function markReviewed(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { action, notes, caseId } = req.body;

    if (!action || !['reviewed', 'associated', 'dismissed'].includes(action)) {
      res
        .status(400)
        .json({
          success: false,
          message:
            'Invalid action. Must be "reviewed", "associated", or "dismissed".',
        });
      return;
    }

    const userId = req.user?._id?.toString() || 'system';

    const result = await unknownPersonService.markReviewed(
      req.params.unknownId,
      userId,
      action,
      notes,
      caseId
    );

    if (!result) {
      res
        .status(404)
        .json({ success: false, message: 'Unknown person identity not found' });
      return;
    }

    sendSuccess(res, `Unknown person marked as ${action}`, result);
  } catch (error) {
    next(error);
  }
}

export async function deleteUnknownPerson(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { unknownId } = req.params;
    const result = await unknownPersonService.deleteUnknownPerson(unknownId);
    if (!result) {
      res.status(404).json({ success: false, message: 'Unknown person identity not found' });
      return;
    }
    sendSuccess(res, 'Unknown person deleted successfully', result);
  } catch (error) {
    next(error);
  }
}
