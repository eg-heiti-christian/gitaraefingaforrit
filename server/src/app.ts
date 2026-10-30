import express, { type RequestHandler } from 'express';
import { toNodeHandler } from 'better-auth/node';
import type { ErrorResponse, HealthResponse } from '@practice/shared';
import { prisma } from './db.js';
import { auth, CLIENT_IP_HEADER } from './auth/auth.js';
import { requireAuth } from './auth/require-auth.js';

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

export function createApp() {
  const app = express();
  // req.ip keys the auth rate limits, so it has to be the client's address,
  // not the proxy's. Loopback covers the Vite dev proxy; TRUST_PROXY sets the
  // proxies to trust at deploy.
  app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

  // Sign-up, sign-in, sign-out and sessions. Better Auth reads the raw body,
  // so this goes before express.json().
  app.all('/api/auth/{*path}', setClientIp, toNodeHandler(auth));

  app.use(express.json());

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

  app.use('/api', (_req, res) => {
    const body: ErrorResponse = { error: 'Not found' };
    res.status(404).json(body);
  });

  return app;
}
