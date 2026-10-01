import { useEffect, useState } from 'react';
import { isApiProblem } from '@/lib/apiClient';
import { getCheckout } from '@/lib/api/checkouts';
import type { Checkout } from '@/lib/api/types';
import { reportError, toUserMessage } from '@/lib/userMessage';

export const ORDER_POLL_INTERVAL_MS = 3000;
export const ORDER_POLL_TIMEOUT_MS = 60000;
const MAX_POLL_INTERVAL_MS = 15000;
const MAX_CONSECUTIVE_ERRORS = 3;

interface OrderStatusPollOptions {
  checkoutId: string;
  token?: string;
  enabled?: boolean;
}

interface OrderStatusPollState {
  checkout: Checkout | null;
  error: string;
  polling: boolean;
  timedOut: boolean;
}

/**
 * Why: Payment can be confirmed a few seconds after the buyer returns to the confirmation page.
 * This loads the checkout and, while it is `pending_payment`, re-fetches about every 3 seconds for
 * up to 60 seconds, stopping on any other status, on unmount, on a 429 and after repeated errors.
 * @param params - Poll options.
 * @param params.checkoutId - Checkout UUID; nothing is fetched while empty.
 * @param params.token - Guest checkout token.
 * @param params.enabled - Set false to skip fetching entirely (e.g. the cancelled path).
 * @returns The latest checkout, a friendly error (only when no checkout could be loaded), whether more polls are
 *   pending, and whether polling gave up while the checkout was still `pending_payment`.
 * @example
 * const { checkout, polling, timedOut } = useOrderStatusPoll({ checkoutId, token, enabled: !isCancelled });
 */
export function useOrderStatusPoll({
  checkoutId,
  token,
  enabled = true,
}: OrderStatusPollOptions): OrderStatusPollState {
  const [state, setState] = useState<OrderStatusPollState>({
    checkout: null,
    error: '',
    polling: false,
    timedOut: false,
  });

  useEffect(() => {
    if (!enabled || !checkoutId) {
      return undefined;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let errors = 0;
    let lastCheckout: Checkout | null = null;
    const startedAt = Date.now();
    setState({ checkout: null, error: '', polling: true, timedOut: false });

    /**
     * Why: Ends polling with the last known checkout; `timedOut` marks a give-up while still pending.
     * @param error - Friendly error to show when there is no checkout to display.
     * @example
     * finish('');
     */
    const finish = (error = ''): void => {
      const pending = lastCheckout?.status === 'pending_payment';
      setState({
        checkout: lastCheckout,
        error: lastCheckout ? '' : error,
        polling: false,
        timedOut: pending,
      });
    };

    /**
     * Why: One poll of the checkout status; reschedules itself until the status settles or time runs out.
     */
    const tick = async (): Promise<void> => {
      try {
        const next = await getCheckout(checkoutId, token);
        if (!active) return;
        errors = 0;
        lastCheckout = next;
        if (next.status !== 'pending_payment') {
          finish();
          return;
        }
        if (Date.now() - startedAt >= ORDER_POLL_TIMEOUT_MS) {
          finish();
          return;
        }
        setState({ checkout: next, error: '', polling: true, timedOut: false });
        timer = setTimeout(tick, ORDER_POLL_INTERVAL_MS);
      } catch (err) {
        if (!active) return;
        errors += 1;
        if (isApiProblem(err, 429) || errors >= MAX_CONSECUTIVE_ERRORS || !lastCheckout) {
          reportError('checkout-status-poll', err);
          finish(toUserMessage(err, "We couldn't load your order details. Please try again."));
          return;
        }
        const wait = Math.min(ORDER_POLL_INTERVAL_MS * 2 ** errors, MAX_POLL_INTERVAL_MS);
        timer = setTimeout(tick, wait);
      }
    };

    tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [checkoutId, token, enabled]);

  return state;
}
