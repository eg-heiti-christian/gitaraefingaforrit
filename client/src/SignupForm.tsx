import { useState, type FormEvent } from 'react';
import { MIN_PASSWORD_LENGTH, signupRequestSchema } from '@practice/shared';
import { useSignup } from './auth';
import Field from './Field';

export default function SignupForm({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const signupMutation = useSignup();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Check with the same schema as the server, to show problems without a round trip.
    const parsed = signupRequestSchema.safeParse({ username, password });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Invalid sign-up details');
      return;
    }
    if (password !== confirm) {
      setValidationError('Passwords do not match');
      return;
    }
    setValidationError(null);
    signupMutation.mutate(parsed.data);
  }

  const error = validationError ?? (signupMutation.isError ? signupMutation.error.message : null);

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-xl bg-zinc-800 p-4">
      <h2 className="text-lg font-semibold">Create an account</h2>

      <Field
        label="Username"
        hint="3–32 characters: letters, digits, _ . -"
        autoComplete="username"
        autoCapitalize="none"
        required
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <Field
        label="Password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Field
        label="Repeat password"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={signupMutation.isPending}
        className="w-full rounded-lg bg-emerald-600 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50"
      >
        {signupMutation.isPending ? 'Creating account…' : 'Sign up'}
      </button>

      <p className="text-center text-sm text-zinc-400">
        Already have an account?{' '}
        <button type="button" onClick={onLogin} className="text-emerald-400 hover:underline">
          Log in
        </button>
      </p>
    </form>
  );
}
