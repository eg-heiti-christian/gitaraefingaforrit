import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from './api';

export default function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  return (
    <main className="min-h-dvh bg-zinc-900 px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold">Practice Tracker</h1>
        <p className="mt-1 text-zinc-400">Weekly guitar routine</p>

        <section className="mt-8 rounded-xl bg-zinc-800 p-4">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-400 uppercase">
            System status
          </h2>
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
      </div>
    </main>
  );
}
