import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from 'better-auth/api';
import { client, EMAIL, signUp } from '../../test/helpers.js';
import { auth } from '../auth/auth.js';
import { prisma } from '../db.js';

const ITEM = { name: 'Spider exercise', description: 'Chromatic, all strings' };

async function loggedIn(email = EMAIL) {
  const agent = client();
  await signUp(agent, email).expect(200);
  return agent;
}

beforeEach(async () => {
  // Items cascade.
  await prisma.user.deleteMany();
});

describe('without a session', () => {
  it.each([
    ['get', '/api/items'],
    ['post', '/api/items'],
    ['put', '/api/items/some-id'],
    ['delete', '/api/items/some-id'],
  ] as const)('%s %s answers 401', async (method, path) => {
    const res = await client()[method](path).send(ITEM);
    expect(res.status).toBe(401);
    expect(await prisma.practiceItem.count()).toBe(0);
  });

  it('answers 401, not 400, to malformed JSON', async () => {
    const res = await client()
      .post('/api/items')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(res.status).toBe(401);
  });
});

describe('when the session check throws an auth error', () => {
  afterEach(() => vi.restoreAllMocks());

  it('answers with its status code, not 500', async () => {
    vi.spyOn(auth.api, 'getSession').mockRejectedValue(new APIError('UNAUTHORIZED'));
    const res = await client().get('/api/items');
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual(expect.any(String));
  });
});

describe('session cookie', () => {
  // These routes have no Origin check of their own, so SameSite=Lax is what
  // keeps cross-site requests from carrying the session.
  it('is SameSite=Lax', async () => {
    const res = await signUp(client()).expect(200);
    const cookie = res.get('Set-Cookie')?.find((value) => value.includes('session_token='));
    expect(cookie).toMatch(/SameSite=Lax/i);
  });
});

describe('POST /api/items', () => {
  it('creates an item for the logged-in user', async () => {
    const agent = await loggedIn();

    const res = await agent.post('/api/items').send(ITEM);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(String), ...ITEM });
    const stored = await prisma.practiceItem.findUniqueOrThrow({
      where: { id: res.body.id },
      include: { user: true },
    });
    expect(stored.user.email).toBe(EMAIL);
  });

  it('trims the name and description', async () => {
    const agent = await loggedIn();
    const res = await agent.post('/api/items').send({ name: '  Scales ', description: ' Major ' });
    expect(res.body).toMatchObject({ name: 'Scales', description: 'Major' });
  });

  it('accepts an empty description', async () => {
    const agent = await loggedIn();
    const res = await agent.post('/api/items').send({ name: 'Scales', description: '' });
    expect(res.status).toBe(201);
    expect(res.body.description).toBe('');
  });

  it('allows duplicate names', async () => {
    const agent = await loggedIn();
    await agent.post('/api/items').send(ITEM).expect(201);
    await agent.post('/api/items').send(ITEM).expect(201);
  });

  it.each([
    ['a blank name', { name: '   ', description: '' }],
    ['a name over 100 characters', { name: 'x'.repeat(101), description: '' }],
    ['a description over 280 characters', { name: 'Scales', description: 'x'.repeat(281) }],
    ['a missing description', { name: 'Scales' }],
    ['a missing name', { description: '' }],
    ['a NUL character in the name', { name: 'a\u0000b', description: '' }],
    ['a NUL character in the description', { name: 'Scales', description: 'a\u0000b' }],
  ])('rejects %s', async (_label, body) => {
    const agent = await loggedIn();
    const res = await agent.post('/api/items').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(await prisma.practiceItem.count()).toBe(0);
  });

  it('accepts a name and description at the limits', async () => {
    const agent = await loggedIn();
    const res = await agent
      .post('/api/items')
      .send({ name: 'x'.repeat(100), description: 'x'.repeat(280) });
    expect(res.status).toBe(201);
  });

  it('answers malformed JSON with a JSON error', async () => {
    const agent = await loggedIn();
    const res = await agent
      .post('/api/items')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(await prisma.practiceItem.count()).toBe(0);
  });

  it('ignores a userId in the body', async () => {
    const victim = await loggedIn('victim@example.com');
    const { body: victimItem } = await victim.post('/api/items').send(ITEM).expect(201);
    const { userId: victimId } = await prisma.practiceItem.findUniqueOrThrow({
      where: { id: victimItem.id },
    });

    const agent = await loggedIn();
    const res = await agent.post('/api/items').send({ ...ITEM, userId: victimId });

    expect(res.status).toBe(201);
    const stored = await prisma.practiceItem.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.userId).not.toBe(victimId);
  });
});

describe('GET /api/items', () => {
  it('lists only your own items, newest first', async () => {
    const other = await loggedIn('other@example.com');
    await other.post('/api/items').send({ name: 'Not mine', description: '' }).expect(201);

    const agent = await loggedIn();
    const { body: older } = await agent
      .post('/api/items')
      .send({ name: 'Older', description: '' })
      .expect(201);
    const { body: newer } = await agent
      .post('/api/items')
      .send({ name: 'Newer', description: '' })
      .expect(201);
    // Set apart explicitly: both could land in the same millisecond.
    await prisma.practiceItem.update({
      where: { id: older.id },
      data: { createdAt: new Date(Date.now() - 60_000) },
    });

    const res = await agent.get('/api/items');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([newer, older]);
  });

  it('answers an empty list when you have no items', async () => {
    const agent = await loggedIn();
    const res = await agent.get('/api/items');
    expect(res.body).toEqual([]);
  });
});

describe('PUT /api/items/:id', () => {
  it('updates the item', async () => {
    const agent = await loggedIn();
    const { body: item } = await agent.post('/api/items').send(ITEM).expect(201);

    const res = await agent
      .put(`/api/items/${item.id}`)
      .send({ name: ' Renamed ', description: '' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: item.id, name: 'Renamed', description: '' });
    const list = await agent.get('/api/items');
    expect(list.body).toEqual([res.body]);
  });

  it('rejects invalid input and leaves the item unchanged', async () => {
    const agent = await loggedIn();
    const { body: item } = await agent.post('/api/items').send(ITEM).expect(201);

    const res = await agent.put(`/api/items/${item.id}`).send({ name: 'No description' });

    expect(res.status).toBe(400);
    const list = await agent.get('/api/items');
    expect(list.body).toEqual([item]);
  });

  it('answers 404 for an item that does not exist', async () => {
    const agent = await loggedIn();
    const res = await agent.put('/api/items/missing').send(ITEM);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Item not found' });
  });

  it("answers 404 for another user's item and leaves it unchanged", async () => {
    const owner = await loggedIn('owner@example.com');
    const { body: item } = await owner.post('/api/items').send(ITEM).expect(201);

    const agent = await loggedIn();
    const res = await agent
      .put(`/api/items/${item.id}`)
      .send({ name: 'Stolen', description: 'Stolen' });

    expect(res.status).toBe(404);
    const list = await owner.get('/api/items');
    expect(list.body).toEqual([item]);
  });
});

describe('DELETE /api/items/:id', () => {
  it('deletes the item', async () => {
    const agent = await loggedIn();
    const { body: item } = await agent.post('/api/items').send(ITEM).expect(201);

    const res = await agent.delete(`/api/items/${item.id}`);

    expect(res.status).toBe(204);
    expect(await prisma.practiceItem.count()).toBe(0);
  });

  it('answers 404 for an item that does not exist', async () => {
    const agent = await loggedIn();
    const res = await agent.delete('/api/items/missing');
    expect(res.status).toBe(404);
  });

  it("answers 404 for another user's item and leaves it in place", async () => {
    const owner = await loggedIn('owner@example.com');
    const { body: item } = await owner.post('/api/items').send(ITEM).expect(201);

    const agent = await loggedIn();
    const res = await agent.delete(`/api/items/${item.id}`);

    expect(res.status).toBe(404);
    expect(await prisma.practiceItem.count()).toBe(1);
  });
});

describe('deleting a user', () => {
  it('deletes their items too', async () => {
    const agent = await loggedIn();
    await agent.post('/api/items').send(ITEM).expect(201);

    await prisma.user.deleteMany();

    expect(await prisma.practiceItem.count()).toBe(0);
  });
});
