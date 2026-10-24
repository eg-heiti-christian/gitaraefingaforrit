// Types shared between client and server.

export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'unreachable';
  timestamp: string;
}
