import type { RequestHandler } from 'express';
import type { ErrorResponse } from '@practice/shared';

/**
 * Counts attempts per IP in a fixed window and answers 429 once the limit is
 * hit. Kept in memory, which is enough for a single server process. Handlers
 * decide what counts: login records only failures and resets on success;
 * signup records every attempt.
 */
export function createAttemptLimiter({
  max,
  windowMs,
  message,
}: {
  max: number;
  windowMs: number;
  message: string;
}) {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  const key = (ip: string | undefined) => ip ?? 'unknown';

  const middleware: RequestHandler = (req, res, next) => {
    const entry = attempts.get(key(req.ip));
    if (entry && entry.resetAt <= Date.now()) {
      attempts.delete(key(req.ip));
    } else if (entry && entry.count >= max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - Date.now()) / 1000));
      const body: ErrorResponse = { error: message };
      res.status(429).json(body);
      return;
    }
    next();
  };

  return {
    middleware,
    record(ip: string | undefined) {
      const entry = attempts.get(key(ip));
      if (entry) entry.count++;
      else attempts.set(key(ip), { count: 1, resetAt: Date.now() + windowMs });
    },
    reset(ip: string | undefined) {
      attempts.delete(key(ip));
    },
  };
}
