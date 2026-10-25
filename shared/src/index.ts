// Types and request schemas shared between client and server.

import { z } from 'zod';

export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'unreachable';
  timestamp: string;
}

// Auth

// Usernames are case-insensitive: both schemas store and look them up in lowercase.
export const loginRequestSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(100),
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const MIN_PASSWORD_LENGTH = 12;

export const signupRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username must be at most 32 characters')
    .regex(/^[a-z0-9_.-]+$/, 'Username may only use letters, digits, _ . and -'),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(200, 'Password must be at most 200 characters'),
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export interface UserResponse {
  id: number;
  username: string;
}

export interface ErrorResponse {
  error: string;
}
