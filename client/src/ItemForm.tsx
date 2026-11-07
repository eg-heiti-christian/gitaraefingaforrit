import { useState, type FormEvent } from 'react';
import {
  itemRequestSchema,
  MAX_ITEM_DESCRIPTION_LENGTH,
  MAX_ITEM_NAME_LENGTH,
  type ItemRequest,
} from '@practice/shared';
import Field from './Field';

type ItemFormProps = {
  initial?: ItemRequest;
  submitLabel: string;
  isPending: boolean;
  serverError: string | null;
  onSubmit: (item: ItemRequest) => void;
  onCancel: () => void;
};

/** The name and description fields, for adding an item or editing one. */
export default function ItemForm({
  initial,
  submitLabel,
  isPending,
  serverError,
  onSubmit,
  onCancel,
}: ItemFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = itemRequestSchema.safeParse({ name, description });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Invalid item');
      return;
    }
    setValidationError(null);
    onSubmit(parsed.data);
  }

  const error = validationError ?? serverError;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field
        label="Name"
        required
        maxLength={MAX_ITEM_NAME_LENGTH}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Field
        label="Description"
        hint="Optional"
        maxLength={MAX_ITEM_DESCRIPTION_LENGTH}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-emerald-600 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-lg bg-zinc-700 px-4 py-2 hover:bg-zinc-600 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
