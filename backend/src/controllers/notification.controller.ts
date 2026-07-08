import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as notificationService from '../services/notification.service';
import { sendSuccess } from '../utils/response';

export async function getList(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await notificationService.getNotifications(req.user!._id.toString());
    sendSuccess(res, 'Notifications retrieved', data);
  } catch (err) {
    next(err);
  }
}

export async function readOne(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await notificationService.markNotificationRead(req.params.id);
    sendSuccess(res, 'Notification marked as read', data);
  } catch (err) {
    next(err);
  }
}

export async function readAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await notificationService.markAllNotificationsRead(req.user!._id.toString());
    sendSuccess(res, 'All notifications marked as read', data);
  } catch (err) {
    next(err);
  }
}
