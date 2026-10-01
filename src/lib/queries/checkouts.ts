import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
} from '@tanstack/react-query';
import { useState } from 'react';
import {
  cancelCheckout,
  createCheckout,
  getCheckout,
  quoteCheckout,
  startCheckoutPayfast,
} from '@/lib/api/checkouts';
import type { CartLine, CreateCheckoutParams } from '@/lib/api/checkouts';
import type { Checkout } from '@/lib/api/types';
import { isApiProblem } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

// Why: Payment can be confirmed a few seconds after the buyer returns, so a pending checkout is
// re-read every 3 seconds, backing off after failures, and given up on after a minute.
export const CHECKOUT_POLL_INTERVAL_MS = 3000;
export const CHECKOUT_POLL_TIMEOUT_MS = 60_000;
const CHECKOUT_POLL_MAX_INTERVAL_MS = 15_000;
const CHECKOUT_POLL_MAX_ERRORS = 3;

/** What `getCheckoutPollInterval` decides from. */
interface PollState {
  /** The latest loaded checkout status, if any. */
  status: Checkout['status'] | undefined;
  /** Milliseconds since polling began. */
  elapsedMs: number;
  /** Consecutive failed fetches. */
  failures: number;
  /** The last fetch error, if it failed. */
  error: unknown;
}

/**
 * Why: One pure rule for when to poll again, so it can be tested without timers.
 * @param state - Latest status, elapsed time, consecutive failures and last error.
 * @returns Milliseconds until the next fetch, or `false` to stop (settled status, timeout, a 429,
 *   or repeated errors).
 * @example
 * getCheckoutPollInterval({ status: 'pending_payment', elapsedMs: 0, failures: 0, error: null }); // 3000
 */
export function getCheckoutPollInterval({
  status,
  elapsedMs,
  failures,
  error,
}: PollState): number | false {
  if (isApiProblem(error, 429) || failures >= CHECKOUT_POLL_MAX_ERRORS) return false;
  if (elapsedMs >= CHECKOUT_POLL_TIMEOUT_MS) return false;
  if (failures > 0) {
    return Math.min(CHECKOUT_POLL_INTERVAL_MS * 2 ** failures, CHECKOUT_POLL_MAX_INTERVAL_MS);
  }
  return status === 'pending_payment' ? CHECKOUT_POLL_INTERVAL_MS : false;
}

/**
 * Why: Payment confirmation and the cancelled path read one checkout; the confirmation page can
 * ask it to poll until payment settles.
 * @param id - Checkout UUID; nothing is fetched while empty.
 * @param token - Guest checkout token.
 * @param options - Options.
 * @param options.poll - Poll while `pending_payment` (see `getCheckoutPollInterval`).
 * @param options.enabled - Set false to skip fetching (e.g. the cancelled path).
 * @returns The query plus `polling` (more polls are coming) and `timedOut` (polling gave up while
 *   still pending).
 * @example
 * const { data: checkout, polling, timedOut } = useCheckout(id, token, { poll: true });
 */
export function useCheckout(
  id: string | null | undefined,
  token?: string | null,
  { poll = false, enabled = true }: { poll?: boolean; enabled?: boolean } = {},
) {
  const [startedAt] = useState(() => Date.now());
  /**
   * Why: Lets TanStack Query ask, after every fetch, how long to wait before the next one.
   * @param query - The checkout query being polled.
   * @returns Milliseconds to wait, or `false` to stop.
   * @example
   * refetchInterval: intervalOf
   */
  const intervalOf = (query: Query<Checkout>) =>
    getCheckoutPollInterval({
      status: query.state.data?.status,
      elapsedMs: Date.now() - startedAt,
      failures: query.state.fetchFailureCount,
      error: query.state.error,
    });

  const query = useQuery({
    queryKey: queryKeys.checkouts.detail(id ?? ''),
    queryFn: () => getCheckout(id as string, token),
    enabled: enabled && Boolean(id),
    // Why: the poll loop does its own backoff, so a failed fetch must not also retry inside it.
    ...(poll ? { retry: false, refetchInterval: intervalOf } : {}),
  });

  // Why: render-safe stand-in for "now": the time of the last fetch result.
  const next = poll
    ? getCheckoutPollInterval({
        status: query.data?.status,
        elapsedMs: Math.max(query.dataUpdatedAt - startedAt, 0),
        failures: query.failureCount,
        error: query.error,
      })
    : false;
  const pending = query.data?.status === 'pending_payment';
  return { ...query, polling: poll && next !== false, timedOut: poll && pending && next === false };
}

/**
 * Why: The checkout page shows the backend's prices, fees and stock issues for the cart; the
 * client never computes totals.
 * @param items - Cart lines; nothing is fetched while empty.
 * @returns The quote query.
 * @example
 * const { data: quote } = useCheckoutQuote(cart.items);
 */
export function useCheckoutQuote(items: CartLine[]) {
  return useQuery({
    queryKey: queryKeys.checkouts.quote(items),
    queryFn: () => quoteCheckout(items),
    enabled: items.length > 0,
    // Why: keep showing the previous totals while a changed cart is re-quoted.
    placeholderData: keepPreviousData,
  });
}

/**
 * Why: Places the order. Stock is reserved by the backend, so product lists are refetched.
 * @returns A mutation taking the checkout params and returning the created checkout.
 * @example
 * const { mutateAsync } = useCreateCheckout();
 * const created = await run(() => mutateAsync({ items, shippingAddress }));
 */
export function useCreateCheckout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateCheckoutParams) => createCheckout(params),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.products.all }),
  });
}

/**
 * Why: Asks the backend for the signed PayFast form fields to post.
 * @returns A mutation taking `{ checkoutId, token }` and returning the PayFast form.
 * @example
 * const { mutateAsync } = useStartPayfast();
 * const form = await run(() => mutateAsync({ checkoutId, token }), { holdOnSuccess: true });
 */
export function useStartPayfast() {
  return useMutation({
    mutationFn: ({ checkoutId, token }: { checkoutId: string; token?: string | null }) =>
      startCheckoutPayfast(checkoutId, token),
  });
}

/**
 * Why: Cancelling releases reserved stock and changes the checkout's status, so both are refetched.
 * @returns A mutation taking `{ checkoutId, token }`.
 * @example
 * const { mutateAsync } = useCancelCheckout();
 * await run(() => mutateAsync({ checkoutId, token }));
 */
export function useCancelCheckout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ checkoutId, token }: { checkoutId: string; token?: string | null }) =>
      cancelCheckout(checkoutId, token),
    onSuccess: async (_data, { checkoutId }) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.checkouts.detail(checkoutId) }),
        client.invalidateQueries({ queryKey: queryKeys.products.all }),
      ]);
    },
  });
}
