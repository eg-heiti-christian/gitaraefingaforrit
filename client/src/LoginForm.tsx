import { useState, type FormEvent } from 'react';
import { loginRequestSchema } from '@practice/shared';
import { useLogin } from './auth';
import Field from './Field';

export default function LoginForm({ onSignup }: { onSignup: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const loginMutation = useLogin();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Same schema as SignupForm uses, so emails are normalized the same way.
    const parsed = loginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Invalid login details');
      return;
    }
    setValidationError(null);
    loginMutation.mutate(parsed.data);
  }

  const error = validationError ?? (loginMutation.isError ? loginMutation.error.message : null);

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl bg-zinc-800 p-4">
      <h2 className="text-lg font-semibold">Log in</h2>

      <Field
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Field
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
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
