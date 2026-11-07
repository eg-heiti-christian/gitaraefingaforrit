import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import { toNodeHandler } from 'better-auth/node';
import type { ErrorResponse, HealthResponse } from '@practice/shared';
import { prisma } from './db.js';
import { auth, CLIENT_IP_HEADER } from './auth/auth.js';
import { requireAuth } from './auth/require-auth.js';
import { itemsRouter } from './items/items.js';

/**
 * Turns TRUST_PROXY into an Express "trust proxy" value. Express only accepts
 * a hop count or a boolean as a number or boolean, not as a string, so those
 * are converted; anything else is a comma-separated list of addresses.
 */
export function parseTrustProxy(value: string | undefined): boolean | number | string {
  const trimmed = value?.trim();
  if (!trimmed) return 'loopback';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

// Hands Better Auth the client address Express resolved, replacing anything
// the client sent in that header.
const setClientIp: RequestHandler = (req, _res, next) => {
  if (req.ip) req.headers[CLIENT_IP_HEADER] = req.ip;
  else delete req.headers[CLIENT_IP_HEADER];
  next();
};

// Answers errors as JSON, like every other API response. Client errors, such as
// malformed JSON from express.json(), keep their status and message; anything
// else is logged and answered with a generic 500. Better Auth's APIError keeps
// its numeric code in statusCode (its status is a name like 'UNAUTHORIZED').
const handleError: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const { statusCode, message, ...rest } = err as {
    status?: unknown;
    statusCode?: unknown;
    message?: unknown;
  };
  const status = typeof statusCode === 'number' ? statusCode : rest.status;
  const isClientError = typeof status === 'number' && status >= 400 && status < 500;
  if (!isClientError) console.error(err);

  const body: ErrorResponse = {
    error: isClientError && typeof message === 'string' ? message : 'Something went wrong',
  };
  res.status(isClientError ? status : 500).json(body);
};

export function createApp() {
  const app = express();
  // req.ip keys the auth rate limits, so it has to be the client's address,
  // not the proxy's. Loopback covers the Vite dev proxy; TRUST_PROXY sets the
  // proxies to trust at deploy.
  app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

  // Sign-up, sign-in, sign-out and sessions. Better Auth reads the raw body,
  // so this goes before express.json().
  app.all('/api/auth/{*path}', setClientIp, toNodeHandler(auth));

  // Public routes.
  app.get('/api/health', async (_req, res) => {
    let database: HealthResponse['database'] = 'connected';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'unreachable';
    }

    const body: HealthResponse = {
      status: database === 'connected' ? 'ok' : 'error',
      database,
      timestamp: new Date().toISOString(),
    };
    res.status(body.status === 'ok' ? 200 : 503).json(body);
  });

  // Every API route registered after this needs a logged-in user.
  app.use('/api', requireAuth);

  // After requireAuth, so anonymous requests are refused before their bodies are parsed.
  app.use(express.json());

  app.use('/api/items', itemsRouter);

  app.use('/api', (_req, res) => {
    const body: ErrorResponse = { error: 'Not found' };
    res.status(404).json(body);
  });

  app.use(handleError);

  return app;
}
