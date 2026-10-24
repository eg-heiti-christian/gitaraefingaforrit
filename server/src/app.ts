import express from 'express';
import type { HealthResponse } from '@practice/shared';
import { prisma } from './db.js';

export function createApp() {
  const app = express();
  app.use(express.json());

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

  return app;
}
