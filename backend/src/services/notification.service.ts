/**
 * notification.service.ts
 * Business logic for user notifications.
 * Includes broadcastToRole for pushing updates to all operators/admins.
 */

import { Types } from 'mongoose';
import * as notificationRepo from '../repositories/notification.repository';
import { AppError } from '../middlewares/error.middleware';
import { User } from '../models/User';

export async function getNotifications(userId: string) {
  const notifications = await notificationRepo.findUserNotifications(userId);
  const unreadCount = await notificationRepo.countUnreadNotifications(userId);
  return { notifications, unreadCount };
}

export async function markNotificationRead(id: string) {
  const notification = await notificationRepo.markAsRead(id);
  if (!notification) throw new AppError('Notification not found', 404);
  return notification;
}

export async function markAllNotificationsRead(userId: string) {
  await notificationRepo.markAllAsRead(userId);
  return { message: 'All notifications marked as read' };
}

export async function addNotification(data: {
  title: string;
  message: string;
  type?: 'alert' | 'info' | 'warning' | 'success';
  userId?: string;
}) {
  return notificationRepo.createNotification({
    title: data.title,
    message: data.message,
    type: data.type,
    userId: data.userId ? new Types.ObjectId(data.userId) : undefined,
  });
}

/**
 * Broadcast a notification to all users of specified roles.
 * Used when a case status is updated — notifies all operators and admins.
 */
export async function broadcastToRole(
  roles: string[],
  data: {
    title: string;
    message: string;
    type?: 'alert' | 'info' | 'warning' | 'success';
  }
): Promise<void> {
  const users = await User.find({ role: { $in: roles }, isActive: true }).select('_id').lean();

  await Promise.allSettled(
    users.map((u) =>
      notificationRepo.createNotification({
        title: data.title,
        message: data.message,
        type: data.type ?? 'info',
        userId: u._id as Types.ObjectId,
      })
    )
  );
}
