import { createAuthClient } from 'better-auth/client';
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

export const fetchHealth = () => request<HealthResponse>('/api/health');

// Better Auth's endpoints under /api/auth, on the same origin (Vite proxies /api in dev).
const authClient = createAuthClient();

type AuthError = { status: number; statusText: string; message?: string };

/** Unwraps a Better Auth client result, throwing ApiError like `request` does. */
async function authCall<T>(call: Promise<{ data: T | null; error: AuthError | null }>) {
  const { data, error } = await call;
  if (error)
    throw new ApiError(error.status, error.message ?? `${error.status} ${error.statusText}`);
  return data;
}

const toUser = ({ id, email, name }: UserResponse): UserResponse => ({ id, email, name });

/** For sign-in and sign-up, which answer with the user on success. */
async function authUser(
  call: Promise<{ data: { user: UserResponse } | null; error: AuthError | null }>,
) {
  const data = await authCall(call);
  if (!data) throw new ApiError(500, 'The server sent no user');
  return toUser(data.user);
}

/** The logged-in user, or null when there is no valid session. */
export async function fetchMe(): Promise<UserResponse | null> {
  const session = await authCall(authClient.getSession());
  return session ? toUser(session.user) : null;
}

export const login = (body: LoginRequest) => authUser(authClient.signIn.email(body));

export const signup = (body: SignupRequest) => authUser(authClient.signUp.email(body));

export const logout = async () => {
  await authCall(authClient.signOut());
};
