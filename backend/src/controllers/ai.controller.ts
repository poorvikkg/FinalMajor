/**
 * ai.controller.ts
 * Gateway controller proxying AI intelligence and RAG queries to the Python AI service.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import axios from 'axios';
import { env } from '../config/env';
import { sendSuccess } from '../utils/response';

export async function query(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { query: userQuery, top_k } = req.body;
    if (!userQuery || typeof userQuery !== 'string') {
      res.status(400).json({ success: false, message: 'Query string is required' });
      return;
    }

    const aiRes = await axios.post(`${env.aiServiceUrl}/ai/query`, {
      query: userQuery,
      top_k: top_k || 5,
    }, { timeout: 60000 });

    sendSuccess(res, 'AI Query Response', aiRes.data);
  } catch (err: any) {
    if (err.response?.data) {
      res.status(err.response.status || 500).json({
        success: false,
        message: err.response.data.detail || err.response.data.message || 'AI Service Error',
      });
      return;
    }
    next(err);
  }
}

export async function chat(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { session_id, message, query: q } = req.body;
    const userQuery = message || q;
    if (!userQuery || typeof userQuery !== 'string') {
      res.status(400).json({ success: false, message: 'Message or query string is required' });
      return;
    }

    const aiRes = await axios.post(`${env.aiServiceUrl}/ai/chat`, {
      session_id: session_id || req.user?._id?.toString() || 'default_session',
      query: userQuery,
      message: userQuery,
    }, { timeout: 60000 });

    sendSuccess(res, 'AI Chat Response', aiRes.data);
  } catch (err: any) {
    if (err.response?.data) {
      res.status(err.response.status || 500).json({
        success: false,
        message: err.response.data.detail || err.response.data.message || 'AI Service Error',
      });
      return;
    }
    next(err);
  }
}

export async function similar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { query: userQuery, top_k } = req.body;
    const aiRes = await axios.post(`${env.aiServiceUrl}/ai/similar`, {
      query: userQuery,
      top_k: top_k || 5,
    }, { timeout: 30000 });

    sendSuccess(res, 'Similar Documents', aiRes.data);
  } catch (err: any) {
    if (err.response?.data) {
      res.status(err.response.status || 500).json({
        success: false,
        message: err.response.data.detail || err.response.data.message || 'AI Service Error',
      });
      return;
    }
    next(err);
  }
}

export async function summarize(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { query: userQuery } = req.body;
    const aiRes = await axios.post(`${env.aiServiceUrl}/ai/summarize`, {
      query: userQuery,
    }, { timeout: 60000 });

    sendSuccess(res, 'AI Summary', aiRes.data);
  } catch (err: any) {
    if (err.response?.data) {
      res.status(err.response.status || 500).json({
        success: false,
        message: err.response.data.detail || err.response.data.message || 'AI Service Error',
      });
      return;
    }
    next(err);
  }
}
