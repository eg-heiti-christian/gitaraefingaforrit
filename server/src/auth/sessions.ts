import { createHash, randomBytes } from 'node:crypto';
import type { UserResponse } from '@practice/shared';
import { prisma } from '../db.js';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Sessions slide: once less than half the lifetime is left, a request extends it.
const RENEW_BELOW_MS = SESSION_TTL_MS / 2;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId: number) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

/**
 * Looks up the session for a cookie token. Returns null when it is missing or
 * expired. `renewedUntil` is set when the expiry was extended, so the caller
 * can refresh the cookie.
 */
export async function validateSession(
  token: string,
): Promise<{ user: UserResponse; renewedUntil?: Date } | null> {
  const id = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { id },
    include: { user: { select: { id: true, username: true } } },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.deleteMany({ where: { id } });
    return null;
  }

  if (session.expiresAt.getTime() - now < RENEW_BELOW_MS) {
    const renewedUntil = new Date(now + SESSION_TTL_MS);
    await prisma.session.update({ where: { id }, data: { expiresAt: renewedUntil } });
    return { user: session.user, renewedUntil };
  }
  return { user: session.user };
}

export async function deleteSession(token: string) {
  await prisma.session.deleteMany({ where: { id: hashToken(token) } });
}
