import request from 'supertest';
import { createApp } from '../src/app.js';

// Better Auth checks the Origin of cookie-carrying POSTs against BETTER_AUTH_URL.
const ORIGIN = 'http://localhost:3001';
export const EMAIL = 'player@example.com';
export const PASSWORD = 'correct horse battery staple';

// Each client gets its own address (through the trusted X-Forwarded-For) so
// the auth rate limits, which live in memory for the whole run, don't carry
// over between tests.
let clients = 0;
export function nextIp() {
  clients++;
  return `10.0.${Math.floor(clients / 250)}.${(clients % 250) + 1}`;
}

/** A cookie-keeping client with its own IP. */
export function client(ip = nextIp()) {
  return request.agent(createApp()).set('Origin', ORIGIN).set('X-Forwarded-For', ip);
}

export function signUp(agent: ReturnType<typeof client>, email = EMAIL, password = PASSWORD) {
  return agent.post('/api/auth/sign-up/email').send({ name: 'Player', email, password });
}
