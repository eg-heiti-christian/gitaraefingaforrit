import express from 'express';
import cookieParser from 'cookie-parser';
import type { ErrorResponse, HealthResponse } from '@practice/shared';
import { prisma } from './db.js';
import { createAuthRouter, requireAuth } from './auth/routes.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

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

  app.use('/api/auth', createAuthRouter());

  // Every API route registered after this needs a logged-in user.
  app.use('/api', requireAuth);

  app.use('/api', (_req, res) => {
    const body: ErrorResponse = { error: 'Not found' };
    res.status(404).json(body);
  });

  return app;
}
