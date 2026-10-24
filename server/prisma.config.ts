import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer reads .env itself; Node's built-in loader covers it.
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on variables already set in the environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
