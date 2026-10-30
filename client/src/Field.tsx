import type { ComponentProps } from 'react';

type FieldProps = ComponentProps<'input'> & { label: string; hint?: string };

/** A labelled text input styled for the dark theme. */
export default function Field({ label, hint, ...inputProps }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm text-zinc-400">{label}</span>
      <input
        className="mt-1 block w-full rounded-lg bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
        {...inputProps}
      />
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}
