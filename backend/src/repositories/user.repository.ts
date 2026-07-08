/**
 * user.repository.ts
 * All database queries for the User collection.
 * Services call these functions — they never query Mongoose directly.
 */

import { User, IUserDocument } from '../models/User';
import { PaginationOptions } from '../utils/pagination';

// Find a user by email (used for login)
export async function findUserByEmail(email: string): Promise<IUserDocument | null> {
  return User.findOne({ email }).select('+password'); // include password for comparison
}

// Find a user by ID
export async function findUserById(id: string): Promise<IUserDocument | null> {
  return User.findById(id).lean() as any;
}

// Get all users with pagination and optional role filter
export async function findAllUsers(
  pagination: PaginationOptions,
  role?: string
): Promise<{ users: IUserDocument[]; total: number }> {
  const filter = role ? { role } : {};
  const [users, total] = await Promise.all([
    User.find(filter)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .lean(),
    User.countDocuments(filter),
  ]);
  return { users: users as any, total };
}

// Create a new user
export async function createUser(data: Partial<IUserDocument>): Promise<IUserDocument> {
  const user = new User(data);
  return user.save();
}

// Update a user by ID
export async function updateUser(
  id: string,
  data: Partial<IUserDocument>
): Promise<IUserDocument | null> {
  return User.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean() as any;
}

// Soft-delete by deactivating the user
export async function deactivateUser(id: string): Promise<IUserDocument | null> {
  return User.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean() as any;
}

// Count total users (for dashboard stats)
export async function countUsers(): Promise<number> {
  return User.countDocuments({ isActive: true });
}
