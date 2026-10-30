import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../db.js';
import { CLIENT_IP_HEADER } from './auth.js';

// Better Auth checks the Origin of cookie-carrying POSTs against BETTER_AUTH_URL.
const ORIGIN = 'http://localhost:3001';
const EMAIL = 'player@example.com';
const PASSWORD = 'correct horse battery staple';

// Each client gets its own address (through the trusted X-Forwarded-For) so
// the auth rate limits, which live in memory for the whole run, don't carry
// over between tests.
let clients = 0;
function nextIp() {
  clients++;
  return `10.0.${Math.floor(clients / 250)}.${(clients % 250) + 1}`;
}

/** A cookie-keeping client with its own IP. */
function client(ip = nextIp()) {
  return request.agent(createApp()).set('Origin', ORIGIN).set('X-Forwarded-For', ip);
}

function signUp(agent: ReturnType<typeof client>, email = EMAIL, password = PASSWORD) {
  return agent.post('/api/auth/sign-up/email').send({ name: 'Player', email, password });
}

function signIn(agent: ReturnType<typeof client>, email = EMAIL, password = PASSWORD) {
  return agent.post('/api/auth/sign-in/email').send({ email, password });
}

beforeEach(async () => {
  // Sessions and accounts cascade.
  await prisma.user.deleteMany();
});

describe('sign-up', () => {
  it('creates the account, logs it in and stores only a password hash', async () => {
    const agent = client();
    const res = await signUp(agent);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: EMAIL, name: 'Player' });
    expect(res.get('Set-Cookie')?.join(';')).toMatch(/session_token=.*HttpOnly/);

    const session = await agent.get('/api/auth/get-session');
    expect(session.body.user.email).toBe(EMAIL);

    const account = await prisma.account.findFirstOrThrow({ where: { providerId: 'credential' } });
    expect(account.password).toBeTruthy();
    expect(account.password).not.toContain(PASSWORD);
  });

  it('rejects a password shorter than 12 characters', async () => {
    const res = await signUp(client(), EMAIL, 'short');
    expect(res.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it.each([
    ['a blank name', '   '],
    ['a name over 100 characters', 'x'.repeat(101)],
  ])('rejects %s', async (_label, name) => {
    const res = await client()
      .post('/api/auth/sign-up/email')
      .send({ name, email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it('stores the trimmed name', async () => {
    await client()
      .post('/api/auth/sign-up/email')
      .send({ name: '  Player  ', email: EMAIL, password: PASSWORD })
      .expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.name).toBe('Player');
  });

  it('rejects fields the shared schema does not cover', async () => {
    const res = await client()
      .post('/api/auth/sign-up/email')
      .send({ name: 'Player', email: EMAIL, password: PASSWORD, image: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it('rejects an email that is already registered', async () => {
    await signUp(client()).expect(200);
    const res = await signUp(client(), EMAIL.toUpperCase());
    expect(res.status).toBe(422);
    expect(await prisma.user.count()).toBe(1);
  });
});

describe('update-user', () => {
  it('is disabled, so names stay as validated at sign-up', async () => {
    const agent = client();
    await signUp(agent).expect(200);

    const res = await agent.post('/api/auth/update-user').send({ name: '' });
    expect(res.status).toBe(404);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.name).toBe('Player');
  });
});

describe('sign-in', () => {
  beforeEach(async () => {
    await signUp(client()).expect(200);
  });

  it('starts a session', async () => {
    const agent = client();
    const res = await signIn(agent);

    expect(res.status).toBe(200);
    const session = await agent.get('/api/auth/get-session');
    expect(session.body.user.email).toBe(EMAIL);
  });

  it('rejects a wrong password and an unknown email with the same 401', async () => {
    const wrongPassword = await signIn(client(), EMAIL, 'not the password');
    const unknownEmail = await signIn(client(), 'nobody@example.com');

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(wrongPassword.get('Set-Cookie')).toBeUndefined();
  });

  it('limits sign-in attempts per IP, and only for that IP', async () => {
    const ip = nextIp();
    for (let i = 0; i < 10; i++) await signIn(client(ip), EMAIL, 'wrong password').expect(401);

    expect((await signIn(client(ip))).status).toBe(429);
    expect((await signIn(client())).status).toBe(200);
  }, 30_000);

  it('records the address Express resolved, not one the client claims', async () => {
    const ip = nextIp();
    await signIn(client(ip)).set(CLIENT_IP_HEADER, '198.51.100.7').expect(200);

    const session = await prisma.session.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });
    expect(session.ipAddress).toBe(ip);
  });

  it('rejects a cross-site request that carries a session cookie', async () => {
    const agent = client();
    await signIn(agent).expect(200);

    const res = await agent.post('/api/auth/sign-out').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
  });
});

describe('sign-out', () => {
  it('ends the session so the cookie stops working', async () => {
    const agent = client();
    await signUp(agent).expect(200);

    await agent.post('/api/auth/sign-out').expect(200);
    expect(await prisma.session.count()).toBe(0);

    const session = await agent.get('/api/auth/get-session');
    expect(session.body).toBeNull();
  });

  // The client relies on this to log out of a session that already ended.
  it('succeeds when the session has already expired or been deleted', async () => {
    const agent = client();
    await signUp(agent).expect(200);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await agent.post('/api/auth/sign-out').expect(200);
    await agent.post('/api/auth/sign-out').expect(200);
  });
});

describe('protected API routes', () => {
  it('require a session', async () => {
    const res = await client().get('/api/anything');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Not logged in' });
  });

  it('are reachable once logged in', async () => {
    const agent = client();
    await signUp(agent).expect(200);

    const res = await agent.get('/api/anything');
    expect(res.status).toBe(404);
  });

  it('reject an expired session', async () => {
    const agent = client();
    await signUp(agent).expect(200);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await agent.get('/api/anything');
    expect(res.status).toBe(401);
  });

  it('extend a session that has not been renewed for a day', async () => {
    const agent = client();
    await signUp(agent).expect(200);
    const dayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await prisma.session.updateMany({ data: { expiresAt: soon, updatedAt: dayAgo } });

    const res = await agent.get('/api/anything');
    expect(res.status).toBe(404);
    const session = await prisma.session.findFirstOrThrow();
    expect(session.expiresAt.getTime()).toBeGreaterThan(soon.getTime());
  });

  it('leave /api/health public', async () => {
    const res = await client().get('/api/health');
    expect(res.status).toBe(200);
  });
});
