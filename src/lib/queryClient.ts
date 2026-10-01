import { QueryClient } from '@tanstack/react-query';
import { isApiProblem } from '@/lib/apiClient';

// Why: How long fetched data counts as fresh, so moving between pages doesn't refetch what was
// just loaded.
export const DEFAULT_STALE_TIME_MS = 30_000;

const MAX_RETRIES = 2;

/**
 * Why: A 4xx rejection will repeat on every retry, so only network failures and 5xx responses
 * are retried.
 * @param failureCount - Failed attempts so far.
 * @param error - The last error.
 * @returns Whether to try again.
 * @example
 * shouldRetry(0, new TypeError('Failed to fetch')); // true
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiProblem(error) && error.status < 500) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

/**
 * Why: One factory so the app and the tests build clients with the same defaults. Window-focus
 * refetching is off because the backend's HTTP caching already keeps data cheap to reload on
 * navigation and the pages show no stale-while-away state worth refreshing.
 * @param overrides - Optional query defaults, e.g. `{ retry: false }` in tests.
 * @returns A new client.
 * @example
 * const [client] = useState(() => makeQueryClient());
 */
export function makeQueryClient(
  overrides: { retry?: boolean | ((count: number, error: unknown) => boolean) } = {},
): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
        ...overrides,
      },
      mutations: { retry: false },
    },
  });
}
