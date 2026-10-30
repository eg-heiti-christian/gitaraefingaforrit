import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, signupRequestSchema } from '@practice/shared';
import { prisma } from '../db.js';

/**
 * Carries the client address that Express worked out from TRUST_PROXY
 * (req.ip) to Better Auth's rate limiter. app.ts overwrites it on every auth
 * request, so a client can't choose its own address by sending it.
 */
export const CLIENT_IP_HEADER = 'x-practice-client-ip';

const DAY_S = 24 * 60 * 60;

// Better Auth only insists on a secret in production; elsewhere it falls back
// to a built-in default that anyone can look up. Refuse to start without one.
if ((process.env.BETTER_AUTH_SECRET ?? '').length < 32) {
  throw new Error(
    'BETTER_AUTH_SECRET must be set to at least 32 characters (see server/.env.example).',
  );
}

// Sign-ups may only carry the fields the shared schema checks. A before hook
// can't drop fields (Better Auth merges its body into the original), so
// anything else, like `image`, is rejected.
const signupBodySchema = signupRequestSchema.strict();

// BETTER_AUTH_URL and BETTER_AUTH_SECRET are read from the environment.
export const auth = betterAuth({
  basePath: '/api/auth',
  // Profile updates would bypass the shared schema, and nothing uses them yet.
  disabledPaths: ['/update-user'],
  // Extra origins allowed to call the API, e.g. the Vite dev server on your
  // LAN. Comma-separated; `*` wildcards are allowed.
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Switch the provider to "postgresql" along with schema.prisma at deploy.
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
  },
  hooks: {
    // Better Auth checks the email and password length, but takes any name.
    // Sign-ups go through the same shared schema as the form, and its
    // normalized values (trimmed name, lowercased email) are what get stored.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-up/email') return;
      const parsed = signupBodySchema.safeParse(ctx.body);
      if (!parsed.success) {
        throw new APIError('BAD_REQUEST', {
          message: parsed.error.issues[0]?.message ?? 'Invalid sign-up details',
        });
      }
      return { context: { body: { ...ctx.body, ...parsed.data } } };
    }),
  },
  session: {
    expiresIn: 30 * DAY_S,
    // Sessions slide: a request more than a day after the last renewal extends it.
    updateAge: DAY_S,
  },
  rateLimit: {
    // On everywhere, not just in production (Better Auth's default).
    enabled: true,
    customRules: {
      '/sign-in/email': { window: 15 * 60, max: 10 },
      '/sign-up/email': { window: 60 * 60, max: 5 },
    },
  },
  advanced: {
    ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    // Better Auth skips its CSRF origin check under test runners by default;
    // keeping it on means the tests cover what runs in production.
    disableOriginCheck: false,
  },
});
