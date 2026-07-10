import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { AppError } from '../middlewares/error.middleware';
import * as recognitionRepo from '../repositories/recognition.repository';
import * as complaintRepo from '../repositories/complaint.repository';
import * as userRepo from '../repositories/user.repository';
import { addNotification } from './notification.service';
import { env } from '../config/env';

/**
 * Downloads an image from a URL and returns it as a Buffer.
 * Used to embed MinIO images into the PDF.
 */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  if (!url || !url.startsWith('http')) return null;
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (err) {
    console.warn(`Failed to fetch image for PDF: ${url}`);
    return null;
  }
}

export async function generateAndSendReport(logId: string, stationId: string, senderId: string): Promise<string> {
  // 1. Fetch Log and Station
  const log = await recognitionRepo.findLogById(logId);
  if (!log) throw new AppError('Recognition log not found', 404);
  if (log.isUnknown || !log.personName) throw new AppError('Cannot generate report for unknown person', 400);

  const station = await userRepo.findUserById(stationId);
  if (!station || station.role !== 'station') throw new AppError('Target is not a valid station', 404);

  // 2. Fetch Complaint Details
  const complaints = await complaintRepo.findAllComplaints({ page: 1, limit: 1, skip: 0 }, { missingPersonName: { $regex: new RegExp(`^${log.personName}$`, 'i') } });
  const complaint = complaints.complaints.length > 0 ? complaints.complaints[0] : null;

  // 3. Create PDF
  const reportsDir = path.join(process.cwd(), 'uploads', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filename = `Report_${logId}_${Date.now()}.pdf`;
  const filePath = path.join(reportsDir, filename);

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text('Missing Person Detection Report', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(12).font('Helvetica').text(`Report Generated: ${new Date().toLocaleString()}`, { align: 'right' });
      doc.moveDown(2);

      // Person Details (from Complaint)
      doc.fontSize(16).font('Helvetica-Bold').text('Missing Person Details');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      if (complaint) {
        doc.fontSize(12).font('Helvetica')
           .text(`Name: ${complaint.missingPersonName}`)
           .text(`Age: ${complaint.age || 'Unknown'}`)
           .text(`Gender: ${complaint.gender || 'Unknown'}`)
           .text(`Description: ${complaint.additionalDescription || 'None provided'}`)
           .text(`Status: ${complaint.status}`);
      } else {
        doc.fontSize(12).font('Helvetica').text(`Name: ${log.personName}`);
        doc.text('Additional details not found in complaint database.');
      }
      doc.moveDown(2);

      // Detection Details
      doc.fontSize(16).font('Helvetica-Bold').text('Detection Details');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      const detectionTime = log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Unknown';
      doc.fontSize(12).font('Helvetica')
         .text(`Time: ${detectionTime}`)
         .text(`Confidence: ${(log.confidence * 100).toFixed(1)}%`);
      
      // If camera is populated, we can show its name
      if (log.cameraId) {
        // @ts-ignore
        doc.text(`Camera: ${log.cameraId.name || log.cameraId}`);
      }
      doc.moveDown(2);

      // Images (side by side)
      doc.fontSize(16).font('Helvetica-Bold').text('Reference & Detection Snapshot');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      const startY = doc.y;

      // Complaint Image (if available)
      if (complaint && complaint.attachments && complaint.attachments.length > 0) {
        const refUrl = complaint.attachments[0];
        const refBuffer = await fetchImageBuffer(refUrl);
        if (refBuffer) {
          doc.fontSize(12).font('Helvetica-Oblique').text('Reference Photo', 50, startY);
          doc.image(refBuffer, 50, startY + 20, { width: 200 });
        }
      }

      // Detection Snapshot
      if (log.snapshot) {
        const snapUrl = log.snapshot;
        const snapBuffer = await fetchImageBuffer(snapUrl);
        if (snapBuffer) {
          doc.fontSize(12).font('Helvetica-Oblique').text('Detection Snapshot', 300, startY);
          doc.image(snapBuffer, 300, startY + 20, { width: 200 });
        }
      }

      doc.end();

      stream.on('finish', async () => {
        // 4. Send Notification
        // Since /uploads is served statically in app.ts, we can just link to it
        const downloadLink = `/uploads/reports/${filename}`;
        
        await addNotification({
          userId: stationId,
          title: 'New Detection Report',
          message: `A detection report for ${log.personName} has been sent to your station. Download: ${downloadLink}`,
          type: 'info'
        });

        resolve(downloadLink);
      });

      stream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}
