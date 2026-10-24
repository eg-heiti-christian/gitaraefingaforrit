import type { HealthResponse } from '@practice/shared';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const fetchHealth = () => getJson<HealthResponse>('/api/health');
