/**
 * sms.service.ts
 * Twilio SMS integration for complainant notifications.
 * Reads credentials from environment variables.
 * Safe-fails if credentials are not configured.
 */

import { env } from '../config/env';
import { ComplaintStatus } from '../types';

let twilioClient: any = null;

// Lazily initialise Twilio only when credentials are present
function getTwilioClient() {
  if (twilioClient) return twilioClient;

  const { accountSid, authToken } = env.twilio;
  if (!accountSid || !authToken) {
    console.warn('[SMS] Twilio credentials not configured. SMS will be skipped.');
    return null;
  }

  try {
    // Dynamic require so the app boots even if twilio is not installed
    const twilio = require('twilio');
    twilioClient = twilio(accountSid, authToken);
    return twilioClient;
  } catch {
    console.warn('[SMS] Twilio package not found. Run: npm install twilio');
    return null;
  }
}

/**
 * Send an SMS to a phone number.
 * Returns true on success, false on failure (non-throwing).
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const client = getTwilioClient();
  if (!client || !env.twilio.phoneNumber) {
    console.warn(`[SMS] Skipped — not configured. Would have sent to ${to}: "${body}"`);
    return false;
  }

  try {
    await client.messages.create({
      body,
      from: env.twilio.phoneNumber,
      to,
    });
    console.log(`[SMS] Sent to ${to}`);
    return true;
  } catch (err: any) {
    console.error(`[SMS] Failed to send to ${to}:`, err.message);
    return false;
  }
}

/**
 * Returns the SMS message body for a given complaint status.
 */
export function getStatusSmsMessage(status: ComplaintStatus, complaintId: string): string | null {
  const id = complaintId;
  const messages: Partial<Record<ComplaintStatus, string>> = {
    complaint_registered:
      `Your missing person complaint has been registered successfully. Complaint ID: ${id}. The authorities have been notified.`,
    searching_cctv:
      `CCTV analysis has started for Complaint ${id}. We will notify you as soon as we have an update.`,
    possible_match_found:
      `A possible match has been detected for Complaint ${id}. Please contact your nearest police station for further information.`,
    match_confirmed:
      `A confirmed match has been found for Complaint ${id}. Please contact your police station immediately.`,
    person_found:
      `Good news! A matching person has been located for Complaint ${id}. Please contact your police station immediately.`,
    case_closed:
      `Complaint ${id} has been closed by the authorities. For further details, please contact your police station.`,
    false_match:
      `The recent detection for Complaint ${id} was a false match. Search continues. You will be notified of any updates.`,
  };

  return messages[status] || null;
}
