import type {
  ErrorResponse,
  HealthResponse,
  LoginRequest,
  SignupRequest,
  UserResponse,
} from '@practice/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ErrorResponse | null;
    throw new ApiError(res.status, body?.error ?? `${res.status} ${res.statusText}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const postJson = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const fetchHealth = () => request<HealthResponse>('/api/health');

/** The logged-in user, or null when there is no valid session. */
export async function fetchMe(): Promise<UserResponse | null> {
  try {
    return await request<UserResponse>('/api/auth/me');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export const login = (body: LoginRequest) => postJson<UserResponse>('/api/auth/login', body);

export const signup = (body: SignupRequest) => postJson<UserResponse>('/api/auth/signup', body);

export const logout = () => postJson<void>('/api/auth/logout');
