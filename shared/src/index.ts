// Types and request schemas shared between client and server.

import { z } from 'zod';

export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'unreachable';
  timestamp: string;
}

// Auth. The /api/auth/* endpoints belong to Better Auth; these schemas mirror
// its email + password limits so the forms can check input before sending.

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

// Trimmed and lowercased before validating, as Better Auth stores emails lowercased.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const signupRequestSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100, 'Name must be at most 100 characters'),
  email: emailSchema,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters`),
});
export type SignupRequest = z.infer<typeof signupRequestSchema>;

/** The logged-in user, as the app sees it. */
export interface UserResponse {
  id: string;
  email: string;
  name: string;
}

// Practice items.

export const MAX_ITEM_NAME_LENGTH = 100;
export const MAX_ITEM_DESCRIPTION_LENGTH = 280;

// Postgres text can't hold NUL characters, so they're refused up front.
const NO_NUL = /^[^\0]*$/;

// Used for both create and update. Both keys are required, so an update that
// leaves out the description can't silently erase it; send '' for none.
export const itemRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name')
    .max(MAX_ITEM_NAME_LENGTH, `Name must be at most ${MAX_ITEM_NAME_LENGTH} characters`)
    .regex(NO_NUL, 'Name contains an invalid character'),
  description: z
    .string()
    .trim()
    .max(
      MAX_ITEM_DESCRIPTION_LENGTH,
      `Description must be at most ${MAX_ITEM_DESCRIPTION_LENGTH} characters`,
    )
    .regex(NO_NUL, 'Description contains an invalid character'),
});
export type ItemRequest = z.infer<typeof itemRequestSchema>;

export interface ItemResponse {
  id: string;
  name: string;
  description: string;
}

export interface ErrorResponse {
  error: string;
}
