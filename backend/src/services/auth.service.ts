/**
 * auth.service.ts
 * Business logic for authentication: login, register, get current user.
 * Throws AppError for expected failures so the error middleware handles them.
 */

import { AppError } from '../middlewares/error.middleware';
import * as userRepo from '../repositories/user.repository';
import { signToken } from '../utils/jwt';
import { LoginInput, RegisterInput } from '../validators/auth.validator';

// Register a new user (admin-only in production, open for dev/first setup)
export async function register(input: RegisterInput) {
  const existing = await userRepo.findUserByEmail(input.email);
  if (existing) {
    throw new AppError('Email already in use', 409);
  }

  const user = await userRepo.createUser(input);
  const token = signToken(user._id, user.role);

  return { user: { id: user._id, name: user.name, email: user.email, role: user.role }, token };
}

// Login and return JWT token
export async function login(input: LoginInput) {
  const user = await userRepo.findUserByEmail(input.email);
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been deactivated', 403);
  }

  const isPasswordCorrect = await user.comparePassword(input.password);
  if (!isPasswordCorrect) {
    throw new AppError('Invalid email or password', 401);
  }

  // Update last login time
  user.lastLogin = new Date();
  await user.save();

  const token = signToken(user._id, user.role);

  return {
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    token,
  };
}

// Get current user profile (called by /auth/me)
export async function getMe(userId: string) {
  const user = await userRepo.findUserById(userId);
  if (!user) throw new AppError('User not found', 404);
  return user;
}
