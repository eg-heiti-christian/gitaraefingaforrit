import { useState } from 'react';
import type { ItemRequest, ItemResponse } from '@practice/shared';
import ItemForm from './ItemForm';
import { useCreateItem, useDeleteItem, useItems, useUpdateItem } from './items';

export default function ItemList({ userId }: { userId: string }) {
  const items = useItems(userId);
  const createItem = useCreateItem();
  const [adding, setAdding] = useState(false);

  function handleCreate(item: ItemRequest) {
    createItem.mutate(item, { onSuccess: () => setAdding(false) });
  }

  return (
    <section className="mt-8 rounded-xl bg-zinc-800 p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Practice items</h2>
        {!adding && (
          <button
            onClick={() => {
              createItem.reset();
              setAdding(true);
            }}
            className="text-sm text-emerald-400 hover:underline"
          >
            Add item
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-4">
          <ItemForm
            submitLabel="Add item"
            isPending={createItem.isPending}
            serverError={createItem.isError ? createItem.error.message : null}
            onSubmit={handleCreate}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {items.isPending && <p className="mt-4 text-zinc-400">Loading…</p>}
      {items.isError && (
        <p className="mt-4 text-red-400">Could not load your items: {items.error.message}</p>
      )}
      {items.data?.length === 0 && !adding && (
        <p className="mt-4 text-zinc-400">No practice items yet. Add your first one.</p>
      )}
      {items.data && items.data.length > 0 && (
        <ul className="mt-4 divide-y divide-zinc-700">
          {items.data.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemRow({ item }: { item: ItemResponse }) {
  const updateItem = useUpdateItem(item.id);
  const deleteItem = useDeleteItem(item.id);
  const [editing, setEditing] = useState(false);

  function handleUpdate(values: ItemRequest) {
    updateItem.mutate(values, { onSuccess: () => setEditing(false) });
  }

  function handleDelete() {
    if (window.confirm(`Delete "${item.name}"? This can't be undone.`)) deleteItem.mutate();
  }

  if (editing) {
    return (
      <li className="py-3">
        <ItemForm
          initial={item}
          submitLabel="Save"
          isPending={updateItem.isPending}
          serverError={updateItem.isError ? updateItem.error.message : null}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium wrap-break-word">{item.name}</p>
          {item.description && (
            <p className="mt-1 text-sm wrap-break-word text-zinc-400">{item.description}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-3 text-sm">
          <button
            onClick={() => {
              updateItem.reset();
              deleteItem.reset();
              setEditing(true);
            }}
            disabled={deleteItem.isPending}
            aria-label={`Edit ${item.name}`}
            className="text-emerald-400 hover:underline disabled:opacity-50"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteItem.isPending}
            aria-label={`Delete ${item.name}`}
            className="text-red-400 hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
      {deleteItem.isError && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          Could not delete: {deleteItem.error.message}
        </p>
      )}
    </li>
  );
}
