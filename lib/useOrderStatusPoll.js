import { useEffect, useState } from 'react';
import { getOrder } from './api/orders';
import { reportError, toUserMessage } from './userMessage';

export const ORDER_POLL_INTERVAL_MS = 3000;
export const ORDER_POLL_TIMEOUT_MS = 60000;
const MAX_POLL_INTERVAL_MS = 15000;
const MAX_CONSECUTIVE_ERRORS = 3;

/**
 * Why: PayFast marks an order paid through a server-to-server notification that often lands a few
 * seconds AFTER the buyer returns to the confirmation page, so a single fetch can show a stale
 * `pending_payment`. This loads the order once and, while it is still `pending_payment`, re-fetches
 * about every 3 seconds for up to 60 seconds. It stops on any other status, on unmount, on a 429
 * (rate limit) and after repeated errors (each error doubles the wait first). Responses that arrive
 * after unmount or after `orderId` changed are ignored. Errors go through `toUserMessage()`.
 * @param {object} params - Poll options.
 * @param {string} params.orderId - Order UUID; nothing is fetched while empty.
 * @param {string} [params.token] - Guest order token.
 * @param {boolean} [params.enabled] - Set false to skip fetching entirely (e.g. the cancelled path).
 * @returns {{order: object|null, error: string, polling: boolean, timedOut: boolean}} The latest
 *   order, a friendly error (only when no order could be loaded), whether more polls are pending,
 *   and whether polling gave up while the order was still `pending_payment`.
 * @example
 * const { order, polling, timedOut } = useOrderStatusPoll({ orderId, token, enabled: !isCancelled });
 */
export function useOrderStatusPoll({ orderId, token, enabled = true }) {
  const [state, setState] = useState({ order: null, error: '', polling: false, timedOut: false });

  useEffect(() => {
    if (!enabled || !orderId) {
      return undefined;
    }

    let active = true;
    let timer = null;
    let errors = 0;
    let lastOrder = null;
    const startedAt = Date.now();
    setState({ order: null, error: '', polling: true, timedOut: false });

    /**
     * Why: Ends polling with the last known order; `timedOut` marks a give-up while still pending.
     * @param {string} [error] - Friendly error to show when there is no order to display.
     * @returns {void}
     * @example
     * finish('');
     */
    const finish = (error = '') => {
      const pending = lastOrder?.status === 'pending_payment';
      setState({ order: lastOrder, error: lastOrder ? '' : error, polling: false, timedOut: pending });
    };

    const tick = async () => {
      try {
        const next = await getOrder(orderId, token);
        if (!active) return;
        errors = 0;
        lastOrder = next;
        if (next.status !== 'pending_payment') {
          finish();
          return;
        }
        if (Date.now() - startedAt >= ORDER_POLL_TIMEOUT_MS) {
          finish();
          return;
        }
        setState({ order: next, error: '', polling: true, timedOut: false });
        timer = setTimeout(tick, ORDER_POLL_INTERVAL_MS);
      } catch (err) {
        if (!active) return;
        errors += 1;
        if (err?.status === 429 || errors >= MAX_CONSECUTIVE_ERRORS || !lastOrder) {
          reportError('order-status-poll', err);
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
  }, [orderId, token, enabled]);

  return state;
}
