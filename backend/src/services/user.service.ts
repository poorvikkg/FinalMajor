/**
 * user.service.ts
 * Business logic for user management (admin operations).
 */

import { AppError } from '../middlewares/error.middleware';
import * as userRepo from '../repositories/user.repository';

export async function getAllUsers(page: number, limit: number, role?: string) {
  return userRepo.findAllUsers({ page, limit, skip: (page - 1) * limit }, role);
}

export async function getUserById(id: string) {
  const user = await userRepo.findUserById(id);
  if (!user) throw new AppError('User not found', 404);
  return user;
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  // Don't allow changing password through this endpoint
  delete data.password;
  const user = await userRepo.updateUser(id, data);
  if (!user) throw new AppError('User not found', 404);
  return user;
}

export async function deleteUser(id: string) {
  const user = await userRepo.deactivateUser(id);
  if (!user) throw new AppError('User not found', 404);
  return user;
}

export async function createUser(data: any) {
  const existingUser = await userRepo.findUserByEmail(data.email);
  if (existingUser) throw new AppError('Email or Username already exists', 400);
  return userRepo.createUser(data);
}
