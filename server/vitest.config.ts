import { defineConfig } from 'vitest/config';

// Load server/.env like `npm run dev` does; variables already set take precedence.
try {
  process.loadEnvFile();
} catch {
  // No .env file.
}

// Tests run against their own database so they never touch dev.db.
const TEST_DATABASE_URL = 'file:./prisma/test.db';

export default defineConfig({
  test: {
    // The rest is pinned so tests don't depend on server/.env: the auth tests
    // give each request its own client IP through X-Forwarded-For, which needs
    // supertest's loopback peer to be a trusted proxy.
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      TRUST_PROXY: 'loopback',
      BETTER_AUTH_URL: 'http://localhost:3001',
      BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      TRUSTED_ORIGINS: '',
    },
    globalSetup: './test/global-setup.ts',
    // Test files share one SQLite database, so run them one at a time.
    fileParallelism: false,
  },
});
