/**
 * camera.repository.ts
 * Database queries for the Camera collection.
 */

import { Camera, ICameraDocument } from '../models/Camera';
import { PaginationOptions } from '../utils/pagination';

export async function findAllCameras(
  pagination: PaginationOptions,
  filter: Record<string, unknown> = {}
): Promise<{ cameras: ICameraDocument[]; total: number }> {
  const [cameras, total] = await Promise.all([
    Camera.find(filter)
      .populate('addedBy', 'name email')
      .skip(pagination.skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .lean(),
    Camera.countDocuments(filter),
  ]);
  return { cameras: cameras as any, total };
}

export async function findCameraById(id: string): Promise<ICameraDocument | null> {
  return Camera.findById(id).populate('addedBy', 'name email').lean() as any;
}

export async function createCamera(data: Partial<ICameraDocument>): Promise<ICameraDocument> {
  const camera = new Camera(data);
  return camera.save();
}

export async function updateCamera(
  id: string,
  data: Partial<ICameraDocument>
): Promise<ICameraDocument | null> {
  return Camera.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean() as any;
}

export async function deleteCamera(id: string): Promise<ICameraDocument | null> {
  return Camera.findByIdAndDelete(id).lean() as any;
}

// Get summary counts for the dashboard
export async function getCameraStats(): Promise<{
  total: number;
  online: number;
  offline: number;
  maintenance: number;
}> {
  const stats = await Camera.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const result = { total: 0, online: 0, offline: 0, maintenance: 0 };
  stats.forEach(({ _id, count }) => {
    result[_id as keyof typeof result] = count;
    result.total += count;
  });
  return result;
}
