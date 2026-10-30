import type { RequestHandler } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import type { ErrorResponse, UserResponse } from '@practice/shared';
import { auth } from './auth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      user: UserResponse;
    }
  }
}

/** Answers 401 unless the request carries a valid session cookie. */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const { headers, response: session } = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
    returnHeaders: true,
  });
  // Passes on the refreshed cookie when the session was extended, or the
  // cleared one when it had expired.
  const cookies = headers.getSetCookie();
  if (cookies.length > 0) res.append('Set-Cookie', cookies);

  if (!session) {
    const body: ErrorResponse = { error: 'Not logged in' };
    res.status(401).json(body);
    return;
  }
  const { id, email, name } = session.user;
  res.locals.user = { id, email, name };
  next();
};
