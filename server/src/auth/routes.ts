import { Router, type CookieOptions, type RequestHandler, type Response } from 'express';
import {
  loginRequestSchema,
  signupRequestSchema,
  type ErrorResponse,
  type UserResponse,
} from '@practice/shared';
import { prisma } from '../db.js';
import { Prisma } from '../generated/prisma/client.js';
import { getDummyHash, hashPassword, verifyPassword } from './password.js';
import { createAttemptLimiter } from './rate-limit.js';
import { createSession, deleteSession, validateSession } from './sessions.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      user: UserResponse;
    }
  }
}

export const SESSION_COOKIE = 'session';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

function setSessionCookie(res: Response, token: string, expires: Date) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, expires });
}

function sendError(res: Response, status: number, error: string) {
  const body: ErrorResponse = { error };
  res.status(status).json(body);
}

function readSessionToken(cookies: Record<string, unknown> | undefined): string | undefined {
  const token = cookies?.[SESSION_COOKIE];
  return typeof token === 'string' && token ? token : undefined;
}

/** Answers 401 unless the request carries a valid session cookie. */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = readSessionToken(req.cookies);
  const session = token ? await validateSession(token) : null;
  if (!token || !session) {
    if (token) res.clearCookie(SESSION_COOKIE, cookieOptions);
    sendError(res, 401, 'Not logged in');
    return;
  }
  if (session.renewedUntil) setSessionCookie(res, token, session.renewedUntil);
  res.locals.user = session.user;
  next();
};

export function createAuthRouter() {
  const router = Router();
  const loginLimiter = createAttemptLimiter({
    max: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Too many login attempts, try again later',
  });
  const signupLimiter = createAttemptLimiter({
    max: 5,
    windowMs: 60 * 60 * 1000,
    message: 'Too many sign-ups, try again later',
  });

  async function startSession(res: Response, user: UserResponse, status = 200) {
    const { token, expiresAt } = await createSession(user.id);
    setSessionCookie(res, token, expiresAt);
    const body: UserResponse = { id: user.id, username: user.username };
    res.status(status).json(body);
  }

  router.post('/signup', signupLimiter.middleware, async (req, res) => {
    signupLimiter.record(req.ip);
    const parsed = signupRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, parsed.error.issues[0]?.message ?? 'Invalid sign-up details');
      return;
    }
    const { username, password } = parsed.data;

    try {
      const user = await prisma.user.create({
        data: { username, passwordHash: await hashPassword(password) },
      });
      await startSession(res, user, 201);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        sendError(res, 409, 'That username is taken');
        return;
      }
      throw err;
    }
  });

  router.post('/login', loginLimiter.middleware, async (req, res) => {
    const parsed = loginRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'Username and password are required');
      return;
    }
    const { username, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { username } });
    const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !valid) {
      loginLimiter.record(req.ip);
      sendError(res, 401, 'Wrong username or password');
      return;
    }

    loginLimiter.reset(req.ip);
    await startSession(res, user);
  });

  router.post('/logout', async (req, res) => {
    const token = readSessionToken(req.cookies);
    if (token) await deleteSession(token);
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.status(204).end();
  });

  router.get('/me', requireAuth, (_req, res) => {
    const body: UserResponse = res.locals.user;
    res.json(body);
  });

  return router;
}
