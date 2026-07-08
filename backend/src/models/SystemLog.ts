/**
 * SystemLog.ts
 * Audit trail for important system events (logins, config changes, etc.).
 * Helps admins track what happened and who did it.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemLogDocument extends Document {
  userId?: mongoose.Types.ObjectId;
  action: string;
  resource: string;
  resourceId?: string;
  details?: object;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const SystemLogSchema = new Schema<ISystemLogDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    action: {
      type: String,
      required: true,
      // e.g. 'LOGIN', 'CREATE_CAMERA', 'DELETE_USER'
    },
    resource: {
      type: String,
      required: true,
      // e.g. 'User', 'Camera', 'Video'
    },
    resourceId: { type: String },
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // we only need createdAt for logs
  }
);

SystemLogSchema.index({ userId: 1 });
SystemLogSchema.index({ action: 1 });
SystemLogSchema.index({ createdAt: -1 });

export const SystemLog = mongoose.model<ISystemLogDocument>('SystemLog', SystemLogSchema);
