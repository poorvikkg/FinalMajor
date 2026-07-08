/**
 * user.controller.ts
 * Handles HTTP requests for user management (admin only).
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as userService from '../services/user.service';
import { sendSuccess, sendPaginated } from '../utils/response';
import { getPaginationOptions, buildPaginationMeta } from '../utils/pagination';

export async function getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = getPaginationOptions(req);
    const role = req.query.role as string | undefined;
    const { users, total } = await userService.getAllUsers(page, limit, role);
    sendPaginated(res, 'Users retrieved', users, buildPaginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.getUserById(req.params.id);
    sendSuccess(res, 'User retrieved', user);
  } catch (err) {
    next(err);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.updateUser(req.params.id, req.body);
    sendSuccess(res, 'User updated', user);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await userService.deleteUser(req.params.id);
    sendSuccess(res, 'User deactivated');
  } catch (err) {
    next(err);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.createUser(req.body);
    sendSuccess(res, 'User created successfully by Administrator', user, 201);
  } catch (err) {
    next(err);
  }
}
