import { useState, type FormEvent } from 'react';
import { useLogin } from './auth';
import Field from './Field';

export default function LoginForm({ onSignup }: { onSignup: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const loginMutation = useLogin();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    loginMutation.mutate({ username, password });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl bg-zinc-800 p-4">
      <h2 className="text-lg font-semibold">Log in</h2>

      <Field
        label="Username"
        autoComplete="username"
        autoCapitalize="none"
        required
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <Field
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {loginMutation.isError && (
        <p role="alert" className="text-sm text-red-400">
          {loginMutation.error.message}
        </p>
      )}

      <button
        type="submit"
        disabled={loginMutation.isPending}
        className="w-full rounded-lg bg-emerald-600 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50"
      >
        {loginMutation.isPending ? 'Logging in…' : 'Log in'}
      </button>

      <p className="text-center text-sm text-zinc-400">
        No account yet?{' '}
        <button type="button" onClick={onSignup} className="text-emerald-400 hover:underline">
          Sign up
        </button>
      </p>
    </form>
  );
}
