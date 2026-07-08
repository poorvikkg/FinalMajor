/**
 * video.repository.ts
 * Database queries for the Video collection.
 */

import { Video, IVideoDocument } from '../models/Video';
import { PaginationOptions } from '../utils/pagination';

export async function findAllVideos(
  pagination: PaginationOptions,
  filter: Record<string, unknown> = {}
): Promise<{ videos: IVideoDocument[]; total: number }> {
  const [videos, total] = await Promise.all([
    Video.find(filter)
      .populate('uploadedBy', 'name email')
      .populate('cameraId', 'name location')
      .skip(pagination.skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .lean(),
    Video.countDocuments(filter),
  ]);
  return { videos: videos as any, total };
}

export async function findVideoById(id: string): Promise<IVideoDocument | null> {
  return Video.findById(id)
    .populate('uploadedBy', 'name email')
    .populate('cameraId', 'name location')
    .lean() as any;
}

export async function createVideo(data: Partial<IVideoDocument>): Promise<IVideoDocument> {
  const video = new Video(data);
  return video.save();
}

export async function updateVideoStatus(
  id: string,
  status: IVideoDocument['status'],
  result?: object,
  errorMessage?: string
): Promise<IVideoDocument | null> {
  return Video.findByIdAndUpdate(
    id,
    { status, processingResult: result, errorMessage },
    { new: true }
  ).lean() as any;
}

export async function deleteVideo(id: string): Promise<IVideoDocument | null> {
  return Video.findByIdAndDelete(id).lean() as any;
}

export async function countVideos(): Promise<number> {
  return Video.countDocuments({ status: 'completed' });
}
