import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ItemRequest } from '@practice/shared';
import { createItem, deleteItem, fetchItems, updateItem } from './api';

// Keyed on the user too, so one account's cached items never show for another.
const allItemsKey = ['items'] as const;

export function useItems(userId: string) {
  return useQuery({ queryKey: [...allItemsKey, userId], queryFn: fetchItems });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: allItemsKey }),
  });
}

// Update and delete refetch on failure too: a 404 means the item is gone, and
// the refetch drops the stale row.
export function useUpdateItem(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ItemRequest) => updateItem(id, body),
    onSettled: () => queryClient.invalidateQueries({ queryKey: allItemsKey }),
  });
}

export function useDeleteItem(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteItem(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: allItemsKey }),
  });
}
