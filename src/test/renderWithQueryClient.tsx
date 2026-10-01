import { render } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { makeQueryClient } from '@/lib/queryClient';

/**
 * Why: Components that use the query hooks need a provider; tests get a fresh client per render
 * (no cache shared between tests) with retries off so a mocked failure surfaces at once.
 * @param ui - The element to render.
 * @param client - Optional client, e.g. one pre-seeded with `setQueryData`.
 * @returns The Testing Library result plus the `client` used.
 * @example
 * const { client } = renderWithQueryClient(<OrdersPage />);
 */
export function renderWithQueryClient(
  ui: ReactElement,
  client: QueryClient = makeQueryClient({ retry: false }),
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...render(ui, { wrapper }), client };
}
