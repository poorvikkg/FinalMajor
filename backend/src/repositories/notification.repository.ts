import { Notification, INotificationDocument } from '../models/Notification';
import { Types } from 'mongoose';

export async function findUserNotifications(
  userId: string,
  limit = 20
): Promise<INotificationDocument[]> {
  return Notification.find({
    $or: [{ userId: new Types.ObjectId(userId) }, { userId: { $exists: false } }],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return Notification.countDocuments({
    $or: [{ userId: new Types.ObjectId(userId) }, { userId: { $exists: false } }],
    isRead: false,
  }).exec();
}

export async function markAsRead(id: string): Promise<INotificationDocument | null> {
  return Notification.findByIdAndUpdate(id, { isRead: true }, { new: true }).exec();
}

export async function markAllAsRead(userId: string): Promise<void> {
  await Notification.updateMany(
    {
      $or: [{ userId: new Types.ObjectId(userId) }, { userId: { $exists: false } }],
      isRead: false,
    },
    { isRead: true }
  ).exec();
}

export async function createNotification(
  data: Partial<INotificationDocument>
): Promise<INotificationDocument> {
  return Notification.create(data);
}
