import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../db.js';
import { hashPassword } from './password.js';

const USERNAME = 'christian';
const PASSWORD = 'correct horse battery staple';

let userId: number;

beforeAll(async () => {
  await prisma.user.deleteMany();
  const user = await prisma.user.create({
    data: { username: USERNAME, passwordHash: await hashPassword(PASSWORD) },
  });
  userId = user.id;
});

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany({ where: { id: { not: userId } } });
});

async function loggedInAgent() {
  const agent = request.agent(createApp());
  await agent.post('/api/auth/login').send({ username: USERNAME, password: PASSWORD }).expect(200);
  return agent;
}

describe('POST /api/auth/login', () => {
  it('sets an httpOnly session cookie and returns the user', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ username: USERNAME, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: userId, username: USERNAME });
    const cookie = res.get('Set-Cookie')?.[0] ?? '';
    expect(cookie).toMatch(/^session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(await prisma.session.count({ where: { userId } })).toBe(1);
  });

  it('stores only a hash of the session token', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ username: USERNAME, password: PASSWORD });
    const token = /^session=([^;]+)/.exec(res.get('Set-Cookie')?.[0] ?? '')?.[1];

    const session = await prisma.session.findFirstOrThrow();
    expect(token).toBeTruthy();
    expect(session.id).not.toBe(token);
  });

  it('rejects a wrong password and an unknown user with the same 401', async () => {
    const app = createApp();
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ username: USERNAME, password: 'nope' });
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ username: 'someone', password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(unknownUser.body).toEqual(wrongPassword.body);
    expect(wrongPassword.get('Set-Cookie')).toBeUndefined();
  });

  it('rejects a malformed body with 400', async () => {
    const res = await request(createApp()).post('/api/auth/login').send({ username: USERNAME });
    expect(res.status).toBe(400);
  });

  it('treats the username case-insensitively', async () => {
    const res = await request(createApp())
      .post('/api/auth/login')
      .send({ username: ` ${USERNAME.toUpperCase()} `, password: PASSWORD });
    expect(res.status).toBe(200);
  });

  it('blocks an IP after 10 failed attempts, even with the right password', async () => {
    const app = createApp();
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ username: USERNAME, password: 'wrong' })
        .expect(401);
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: USERNAME, password: PASSWORD });
    expect(res.status).toBe(429);
    expect(res.get('Retry-After')).toBeTruthy();
  }, 30_000);
});

describe('POST /api/auth/signup', () => {
  const NEW_PASSWORD = 'another long password';

  it('creates the account, logs it in and stores a hashed password', async () => {
    const agent = request.agent(createApp());
    const res = await agent
      .post('/api/auth/signup')
      .send({ username: 'NewPlayer', password: NEW_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ username: 'newplayer' });
    expect(res.get('Set-Cookie')?.[0]).toMatch(/^session=.*HttpOnly/);

    const me = await agent.get('/api/auth/me');
    expect(me.body).toEqual(res.body);

    const user = await prisma.user.findUniqueOrThrow({ where: { username: 'newplayer' } });
    expect(user.passwordHash).not.toContain(NEW_PASSWORD);
    expect(user.passwordHash).toMatch(/^scrypt\$/);
  });

  it('lets the new account log in afterwards', async () => {
    const app = createApp();
    await request(app)
      .post('/api/auth/signup')
      .send({ username: 'newplayer', password: NEW_PASSWORD })
      .expect(201);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'newplayer', password: NEW_PASSWORD });
    expect(res.status).toBe(200);
  });

  it('rejects a taken username, ignoring case, with 409', async () => {
    const res = await request(createApp())
      .post('/api/auth/signup')
      .send({ username: USERNAME.toUpperCase(), password: NEW_PASSWORD });

    expect(res.status).toBe(409);
    expect(res.get('Set-Cookie')).toBeUndefined();
  });

  it.each([
    [{ username: 'newplayer', password: 'short' }, /at least 12/],
    [{ username: 'ab', password: NEW_PASSWORD }, /at least 3/],
    [{ username: 'has space', password: NEW_PASSWORD }, /only use/],
    [{ username: 'newplayer' }, /./],
  ])('rejects invalid details %j with 400', async (body, message) => {
    const res = await request(createApp()).post('/api/auth/signup').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
    expect(await prisma.user.count()).toBe(1);
  });

  it('allows at most 5 sign-ups per IP per hour', async () => {
    const app = createApp();
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/signup')
        .send({ username: `player${i}`, password: NEW_PASSWORD })
        .expect(201);
    }

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'player5', password: NEW_PASSWORD });
    expect(res.status).toBe(429);
  }, 30_000);
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a session', async () => {
    const res = await request(createApp()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for an unknown token', async () => {
    const res = await request(createApp()).get('/api/auth/me').set('Cookie', 'session=forged');
    expect(res.status).toBe(401);
  });

  it('returns the logged-in user', async () => {
    const agent = await loggedInAgent();
    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: userId, username: USERNAME });
  });

  it('rejects and deletes an expired session', async () => {
    const agent = await loggedInAgent();
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(await prisma.session.count()).toBe(0);
  });

  it('extends a session that is close to expiring', async () => {
    const agent = await loggedInAgent();
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.session.updateMany({ data: { expiresAt: soon } });

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.get('Set-Cookie')?.[0]).toMatch(/^session=/);
    const session = await prisma.session.findFirstOrThrow();
    expect(session.expiresAt.getTime()).toBeGreaterThan(soon.getTime());
  });
});

describe('POST /api/auth/logout', () => {
  it('deletes the session so the cookie stops working', async () => {
    const app = createApp();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: USERNAME, password: PASSWORD });
    const cookie = login.get('Set-Cookie')?.[0].split(';')[0] ?? '';

    const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(res.status).toBe(204);
    expect(res.get('Set-Cookie')?.[0]).toMatch(/^session=;/);
    expect(await prisma.session.count()).toBe(0);

    const after = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(after.status).toBe(401);
  });
});

describe('protected API routes', () => {
  it('require a session', async () => {
    const res = await request(createApp()).get('/api/anything');
    expect(res.status).toBe(401);
  });

  it('are reachable once logged in', async () => {
    const agent = await loggedInAgent();
    const res = await agent.get('/api/anything');
    expect(res.status).toBe(404);
  });

  it('leave /api/health public', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
  });
});
