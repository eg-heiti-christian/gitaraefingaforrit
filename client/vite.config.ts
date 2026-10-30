import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // host: true exposes the dev server on your LAN so you can test on your phone.
    host: true,
    proxy: {
      // xfwd passes the client's address on, so the API rate-limits per device.
      '/api': { target: 'http://localhost:3001', xfwd: true },
    },
  },
});
