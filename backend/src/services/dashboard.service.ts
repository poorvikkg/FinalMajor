/**
 * dashboard.service.ts
 * Aggregates data from multiple collections for the dashboard overview.
 * Runs queries in parallel using Promise.all for better performance.
 */

import * as userRepo from '../repositories/user.repository';
import * as cameraRepo from '../repositories/camera.repository';
import * as videoRepo from '../repositories/video.repository';
import * as recognitionRepo from '../repositories/recognition.repository';
import { RecognitionLog } from '../models/RecognitionLog';
import { Complaint } from '../models/Complaint';
import { SystemLog } from '../models/SystemLog';

export async function getDashboardStats() {
  // Run all counts in parallel — much faster than sequential queries
  const [userCount, cameraStats, videosProcessed, todayRecognitions, unknownDetections] =
    await Promise.all([
      userRepo.countUsers(),
      cameraRepo.getCameraStats(),
      videoRepo.countVideos(),
      recognitionRepo.countTodayRecognitions(),
      recognitionRepo.countUnknownDetections(),
    ]);

  return {
    users: { total: userCount },
    cameras: cameraStats,
    videos: { processed: videosProcessed },
    recognitions: {
      today: todayRecognitions,
      unknownDetections,
    },
  };
}

// Get recent alerts (unknown faces detected in last 24h)
export async function getRecentAlerts(limit = 5) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return RecognitionLog.find({ isUnknown: true, timestamp: { $gte: since } })
    .populate('cameraId', 'name location')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
}

// Get recent complaints
export async function getRecentComplaints(limit = 5) {
  return Complaint.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

// Get recent system activity
export async function getRecentActivity(limit = 10) {
  return SystemLog.find()
    .populate('userId', 'name')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}
