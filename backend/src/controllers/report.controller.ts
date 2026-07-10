import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as reportService from '../services/report.service';
import { sendSuccess } from '../utils/response';
import { z } from 'zod';
import { AppError } from '../middlewares/error.middleware';

const sendReportSchema = z.object({
  logId: z.string(),
  stationId: z.string()
});

export async function sendReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { logId, stationId } = sendReportSchema.parse(req.body);
    const senderId = req.user?._id.toString();
    
    if (!senderId) throw new AppError('Unauthorized', 401);

    const downloadLink = await reportService.generateAndSendReport(logId, stationId, senderId);
    
    sendSuccess(res, 'Report generated and sent to station successfully', { downloadLink });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(err.errors[0].message, 400));
    } else {
      next(err);
    }
  }
}
