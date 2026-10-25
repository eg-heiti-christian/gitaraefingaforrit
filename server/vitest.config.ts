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
    env: { DATABASE_URL: TEST_DATABASE_URL },
    globalSetup: './test/global-setup.ts',
    // Test files share one SQLite database, so run them one at a time.
    fileParallelism: false,
  },
});
