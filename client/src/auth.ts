import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { UserResponse } from '@practice/shared';
import { fetchMe, login, logout, signup } from './api';

export const meQueryKey = ['me'] as const;

/**
 * Drops everything cached for the old session, then shows the login form.
 * The ['me'] query is kept (only set to null) so App's observer stays attached.
 */
export function clearSession(queryClient: QueryClient) {
  removeUserData(queryClient);
  queryClient.setQueryData(meQueryKey, null);
}

// Every query except ['me'] holds the logged-in user's data.
const userDataFilter = {
  predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== meQueryKey[0],
};

function removeUserData(queryClient: QueryClient) {
  queryClient.removeQueries(userDataFilter);
}

/**
 * The logged-in user. Another tab may have logged out, or into a different
 * account, with the shared cookie, so this is rechecked when the window
 * regains focus or the network comes back. Other queries don't refetch on
 * those events themselves (see main.tsx); the check runs first and then
 * refetches them, so they never load with a cookie that belongs to someone else.
 */
export function useMe() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async () => {
      const previous = queryClient.getQueryData<UserResponse | null>(meQueryKey);
      const user = await fetchMe();
      if (previous && previous.id !== user?.id) {
        // Store the new user before dropping the old one's data, so the page
        // re-renders for the new user instead of refetching for the old one.
        queryClient.setQueryData(meQueryKey, user);
        removeUserData(queryClient);
      } else if (previous) {
        void queryClient.invalidateQueries(userDataFilter);
      }
      return user;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signup,
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => clearSession(queryClient),
  });
}
