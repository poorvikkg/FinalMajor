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
import { Sighting } from '../models/Sighting';

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

      stream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

// ─── Generate Complaint Report PDF directly to response stream ──────────────────
export async function generateComplaintReport(complaintId: string, res: any): Promise<void> {
  const complaint = await complaintRepo.findComplaintById(complaintId);
  if (!complaint) throw new AppError('Complaint not found', 404);

  // Fetch all real sightings for this person from database (no dummy data)
  const sightings = await Sighting.find({ personId: complaint._id })
    .populate('cameraId', 'name location')
    .sort({ detectedAt: -1 })
    .limit(15)
    .lean();

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  const primaryColor = '#0f172a'; // slate-900
  const secondaryColor = '#475569'; // slate-600
  const dividerColor = '#cbd5e1'; // slate-300

  // 1. Bureau Title Header
  doc.fillColor(primaryColor)
     .fontSize(18)
     .font('Helvetica-Bold')
     .text('NATIONAL CRIME RECORDS & SURVEILLANCE BUREAU', { align: 'center' });
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .text('OFFICIAL MISSING PERSON DETAILED DOSSIER', { align: 'center' });
  doc.moveDown(0.5);

  // Divider
  doc.moveTo(50, doc.y)
     .lineTo(545, doc.y)
     .strokeColor(primaryColor)
     .lineWidth(2)
     .stroke();
  doc.moveDown(1);

  // 2. Case Identifiers (Right aligned)
  const metaY = doc.y;
  doc.fillColor(secondaryColor)
     .fontSize(10)
     .font('Helvetica')
     .text(`Case ID: ${complaint.complaintId || 'N/A'}`, 350, metaY, { align: 'right' })
     .text(`Date Registered: ${new Date(complaint.createdAt).toLocaleDateString()}`, 350, metaY + 14, { align: 'right' })
     .text(`Case Status: ${complaint.status || 'ACTIVE'}`, 350, metaY + 28, { align: 'right' });

  // 3. Image Section (Left side)
  let photoY = metaY;
  let textStartX = 50;

  if (complaint.attachments && complaint.attachments.length > 0) {
    const photoPath = path.resolve(process.cwd(), complaint.attachments[0]);
    if (fs.existsSync(photoPath)) {
      try {
        doc.image(photoPath, 50, photoY, { width: 120, height: 140, fit: [120, 140] });
        textStartX = 190;
      } catch (err) {
        console.warn('Failed to embed local image in PDF:', err);
      }
    }
  }

  // 4. Personal Info block
  doc.fillColor(primaryColor)
     .fontSize(13)
     .font('Helvetica-Bold')
     .text('Dossier details', textStartX, photoY);
  doc.moveTo(textStartX, doc.y).lineTo(545, doc.y).strokeColor(dividerColor).lineWidth(0.5).stroke();
  doc.moveDown(0.5);

  const labelFont = 'Helvetica-Bold';
  const valFont = 'Helvetica';
  const detailFontSize = 10;
  const lineSpacing = 16;

  let currentY = doc.y;
  doc.fontSize(detailFontSize);

  const details = [
    { label: 'Full Name:', value: complaint.missingPersonName },
    { label: 'Age / Gender:', value: `${complaint.age || 'N/A'} years / ${complaint.gender || 'N/A'}` },
    { label: 'Height / Weight:', value: `${complaint.height || 'N/A'} / ${complaint.weight || 'N/A'}` },
    { label: 'Hair / Eye Color:', value: `${complaint.hairColor || 'N/A'} / ${complaint.eyeColor || 'N/A'}` },
    { label: 'Last Seen Time:', value: complaint.lastSeenTime ? new Date(complaint.lastSeenTime).toLocaleString() : 'N/A' },
    { label: 'Last Seen Area:', value: complaint.lastSeenLocation || 'N/A' },
    { label: 'Registered Station:', value: complaint.policeStation || 'N/A' },
  ];

  details.forEach((d) => {
    doc.font(labelFont).text(d.label, textStartX, currentY);
    doc.font(valFont).text(String(d.value), textStartX + 110, currentY);
    currentY += lineSpacing;
  });

  // Contact Info
  currentY += 8;
  doc.font(labelFont).fontSize(11).text('Reporting Contact Info', textStartX, currentY);
  doc.moveTo(textStartX, doc.y + 2).lineTo(545, doc.y + 2).strokeColor(dividerColor).lineWidth(0.5).stroke();
  currentY += 15;

  const contactY = currentY;
  doc.fontSize(detailFontSize);
  doc.font(labelFont).text('Contact Name:', textStartX, contactY);
  doc.font(valFont).text(complaint.reporterName || 'N/A', textStartX + 110, contactY);
  
  doc.font(labelFont).text('Phone Number:', textStartX, contactY + lineSpacing);
  doc.font(valFont).text(complaint.reporterMobile || 'N/A', textStartX + 110, contactY + lineSpacing);

  doc.font(labelFont).text('Relationship:', textStartX, contactY + (lineSpacing * 2));
  doc.font(valFont).text(complaint.reporterRelationship || 'N/A', textStartX + 110, contactY + (lineSpacing * 2));

  // Description Block
  doc.y = Math.max(photoY + 155, contactY + (lineSpacing * 2) + 25);
  doc.fillColor(primaryColor)
     .font('Helvetica-Bold')
     .fontSize(13)
     .text('Physical & Additional Description', 50, doc.y);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(dividerColor).lineWidth(0.5).stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(10).fillColor(secondaryColor).text(complaint.additionalDescription || 'No description recorded.', { width: 495 });
  doc.moveDown(1.5);

  // 5. System Sightings History (No Dummy Data!)
  doc.fillColor(primaryColor)
     .font('Helvetica-Bold')
     .fontSize(13)
     .text('AI Surveillance Sighting Logs', 50, doc.y);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(dividerColor).lineWidth(0.5).stroke();
  doc.moveDown(0.5);

  if (sightings.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(secondaryColor).text('No surveillance sightings recorded in the system yet.');
  } else {
    // Sightings Table Headers
    const tableHeaderY = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor);
    doc.text('Timestamp', 50, tableHeaderY);
    doc.text('CCTV Source Location', 190, tableHeaderY);
    doc.text('GPS Coordinates', 360, tableHeaderY);
    doc.text('Confidence Score', 470, tableHeaderY);
    
    doc.moveTo(50, tableHeaderY + 12).lineTo(545, tableHeaderY + 12).strokeColor(secondaryColor).lineWidth(1).stroke();
    
    let rowY = tableHeaderY + 18;
    doc.font('Helvetica').fontSize(9).fillColor(secondaryColor);

    sightings.forEach((s) => {
      if (rowY > 730) {
        doc.addPage();
        rowY = 50;
      }
      const dateStr = new Date(s.detectedAt).toLocaleString();
      const cameraName = s.cameraId && (s.cameraId as any).name ? (s.cameraId as any).name : 'CCTV Camera';
      const coordsStr = `${s.location.latitude.toFixed(4)}, ${s.location.longitude.toFixed(4)}`;
      const confStr = `${(s.similarity * 100).toFixed(1)}%`;

      doc.text(dateStr, 50, rowY);
      doc.text(cameraName, 190, rowY, { width: 160 });
      doc.text(coordsStr, 360, rowY);
      doc.text(confStr, 470, rowY);

      doc.moveTo(50, rowY + 12).lineTo(545, rowY + 12).strokeColor(dividerColor).lineWidth(0.5).stroke();
      rowY += 18;
    });
  }

  // Footer & Official Seal Y positioning
  doc.y = Math.min(doc.y + 40, 715);
  if (doc.y > 680) {
    doc.addPage();
    doc.y = 50;
  }
  
  const signY = doc.y + 20;
  doc.moveTo(50, signY).lineTo(200, signY).strokeColor(secondaryColor).lineWidth(0.5).stroke();
  doc.moveTo(395, signY).lineTo(545, signY).strokeColor(secondaryColor).lineWidth(0.5).stroke();

  doc.fontSize(8).font('Helvetica-Bold').fillColor(secondaryColor);
  doc.text('SYSTEM AUDITOR', 50, signY + 5, { width: 150, align: 'center' });
  doc.text('AI SURVEILLANCE RECORDS', 50, signY + 14, { width: 150, align: 'center' });

  doc.text('STATION IN-CHARGE', 395, signY + 5, { width: 150, align: 'center' });
  doc.text('OFFICIAL SIGNATURE & SEAL', 395, signY + 14, { width: 150, align: 'center' });

  doc.end();
}
