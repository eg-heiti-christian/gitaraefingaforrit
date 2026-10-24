import { defineConfig } from 'vitest/config';

// Load server/.env like `npm run dev` does; variables already set take precedence.
try {
  process.loadEnvFile();
} catch {
  // No .env file.
}

export default defineConfig({});
