import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from './api';
import { useLogout, useMe } from './auth';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';

export default function App() {
  const me = useMe();
  const logout = useLogout();
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');

  return (
    <main className="min-h-dvh bg-zinc-900 px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-md">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Practice Tracker</h1>
            <p className="mt-1 text-zinc-400">Weekly guitar routine</p>
          </div>
          {me.data && (
            <div className="text-right text-sm">
              <p className="text-zinc-400" title={me.data.email}>
                {me.data.name}
              </p>
              <button
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="mt-1 text-emerald-400 hover:underline disabled:opacity-50"
              >
                Log out
              </button>
            </div>
          )}
        </header>

        {me.isPending && <p className="mt-8 text-zinc-400">Loading…</p>}
        {me.isError && <p className="mt-8 text-red-400">Could not reach the API.</p>}
        {me.data === null &&
          (authView === 'login' ? (
            <LoginForm onSignup={() => setAuthView('signup')} />
          ) : (
            <SignupForm onLogin={() => setAuthView('login')} />
          ))}
        {me.data && <SystemStatus />}
      </div>
    </main>
  );
}

function SystemStatus() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  return (
    <section className="mt-8 rounded-xl bg-zinc-800 p-4">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-400 uppercase">System status</h2>
      {health.isPending && <p className="mt-2">Checking…</p>}
      {health.isError && (
        <p className="mt-2 text-red-400">API unreachable: {health.error.message}</p>
      )}
      {health.data && (
        <ul className="mt-2 space-y-1">
          <li>
            API: <span className="text-emerald-400">{health.data.status}</span>
          </li>
          <li>
            Database: <span className="text-emerald-400">{health.data.database}</span>
          </li>
        </ul>
      )}
    </section>
  );
}
