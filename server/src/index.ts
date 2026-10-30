import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);

if (process.env.NODE_ENV === 'production' && !process.env.TRUST_PROXY?.trim()) {
  console.warn(
    'TRUST_PROXY is not set. If the API runs behind a reverse proxy on another host, ' +
      'every client gets the same IP and shares one login rate limit.',
  );
}

createApp().listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
