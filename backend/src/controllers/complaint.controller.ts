/**
 * complaint.controller.ts
 * Handles HTTP requests for missing person complaint management.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as complaintService from '../services/complaint.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { getPaginationOptions, buildPaginationMeta } from '../utils/pagination';
import { uploadToMinio } from '../services/minio.service';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { env } from '../config/env';

export async function getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = getPaginationOptions(req);
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;
    const { complaints, total } = await complaintService.getAllComplaints(page, limit, status, priority);
    sendPaginated(res, 'Complaints retrieved', complaints, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const complaint = await complaintService.getComplaintById(req.params.id);
    sendSuccess(res, 'Complaint retrieved', complaint);
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await complaintService.getCaseHistory(req.params.id);
    sendSuccess(res, 'Case history retrieved', history);
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const attachmentUrls: string[] = [];
    const localFilesToRegister: string[] = [];

    if (req.files && Array.isArray(req.files)) {
      const filesList = req.files as Express.Multer.File[];
      for (const file of filesList) {
        const url = await uploadToMinio(file.path, 'attachments');
        attachmentUrls.push(url);
        localFilesToRegister.push(file.path);
      }
    } else if (req.file) {
      const file = req.file as Express.Multer.File;
      const url = await uploadToMinio(file.path, 'attachments');
      attachmentUrls.push(url);
      localFilesToRegister.push(file.path);
    }

    req.body.attachments = attachmentUrls;
    const complaint = await complaintService.createComplaint(req.body, req.user?._id);

    // Register all face photos as one batch → one strong composite embedding
    if (localFilesToRegister.length > 0) {
      const userIdStr = complaint._id.toString();
      try {
        const formData = new FormData();
        formData.append('user_id', userIdStr);

        const fileBuffers: { buffer: Buffer; name: string }[] = [];
        for (const filePath of localFilesToRegister) {
          const buffer = fs.readFileSync(filePath);
          const name = filePath.split(/[\\\/]/).pop() || 'face.jpg';
          fileBuffers.push({ buffer, name });
          formData.append('images', buffer, { filename: name, contentType: 'image/jpeg' });
        }

        const response = await axios.post(`${env.aiServiceUrl}/register/batch/`, formData, {
          headers: formData.getHeaders(),
          timeout: 30000, // larger timeout for multiple images
        });

        const result = response.data?.data || response.data;
        console.log(
          `[AI] Batch registered complaint ${userIdStr}: ` +
          `${result.images_processed ?? '?'} processed, ` +
          `${result.images_skipped ?? '?'} skipped`
        );
        if (result.skip_reasons?.length) {
          console.warn(`[AI] Skipped reasons:`, result.skip_reasons);
        }
      } catch (err: any) {
        console.error('[AI] Batch registration failed:', err.response?.data || err.message);
        // Non-fatal — complaint is still created, face search just won't work for this case
      } finally {
        // Clean up temp files
        for (const filePath of localFilesToRegister) {
          try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
        }
      }
    }

    sendSuccess(res, 'Complaint submitted successfully', complaint, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const evidenceUrls: string[] = [];

    // Handle evidence image uploads if any
    if (req.files && Array.isArray(req.files)) {
      const filesList = req.files as Express.Multer.File[];
      for (const file of filesList) {
        try {
          const url = await uploadToMinio(file.path, 'evidence');
          evidenceUrls.push(url);
        } finally {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
      }
    }

    if (evidenceUrls.length > 0) {
      req.body.evidenceImages = evidenceUrls;
    }

    const result = await complaintService.updateComplaintStatus(
      req.params.id,
      req.body,
      req.user?._id
    );
    sendSuccess(res, 'Case status updated', result);
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const complaint = await complaintService.updateComplaint(req.params.id, req.body);
    sendSuccess(res, 'Complaint updated', complaint);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await complaintService.deleteComplaint(req.params.id);
    sendSuccess(res, 'Complaint deleted successfully');
  } catch (err) {
    next(err);
  }
}

export async function removeAttachment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ success: false, message: 'Attachment URL is required' });
      return;
    }
    const updated = await complaintService.removeAttachment(req.params.id, url);
    sendSuccess(res, 'Attachment removed successfully', updated);
  } catch (err) {
    next(err);
  }
}

export async function getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await complaintService.getComplaintStats();
    sendSuccess(res, 'Complaint stats retrieved', stats);
  } catch (err) {
    next(err);
  }
}
