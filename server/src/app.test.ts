import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, parseTrustProxy } from './app.js';

describe('parseTrustProxy', () => {
  it.each([
    [undefined, 'loopback'],
    ['', 'loopback'],
    ['  ', 'loopback'],
    ['1', 1],
    ['true', true],
    ['false', false],
    ['loopback, 10.0.0.0/8', 'loopback, 10.0.0.0/8'],
  ])('parses %j as %j', (value, expected) => {
    expect(parseTrustProxy(value)).toEqual(expected);
  });

  it.each(['1', 'true', '10.0.0.1'])('lets createApp start with TRUST_PROXY=%j', (value) => {
    const original = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = value;
    try {
      expect(() => createApp()).not.toThrow();
    } finally {
      if (original === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = original;
    }
  });
});

describe('GET /api/health', () => {
  it('reports ok with a connected database', async () => {
    const res = await request(createApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'connected' });
  });
});
