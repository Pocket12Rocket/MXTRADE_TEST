import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { getOrderToken, getPaymentStepCopy, storeCheckoutToken } from '@/lib/api/orders';
import { isApiProblem } from '@/lib/apiClient';
import { cancelCheckout } from '@/lib/api/checkouts';
import type { CheckoutStatus } from '@/lib/api/types';
import { reportError, toUserMessage } from '@/lib/userMessage';
import { useOrderStatusPoll } from './useOrderStatusPoll';
import useAuth from '@/lib/useAuth';
import { useCart } from '@/features/cart/cartContext';

const FAILED_STATUSES: CheckoutStatus[] = ['payment_failed', 'cancelled'];

/**
 * Why: Where PayFast returns the buyer after paying for a checkout, and where a guest's emailed
 * link lands (`?checkoutId=…&token=…`). It stores and strips the token, releases the stock hold on
 * a cancelled payment, otherwise polls the checkout (`useOrderStatusPoll`) until payment is
 * confirmed, then lists each seller's order.
 * @returns The confirming, confirmed, failed, late-payment or cancelled state.
 * @example
 * // Rendered at /order/confirmation?checkoutId=<uuid>&payment=cancelled
 * <OrderConfirmationPage />
 */
export default function OrderConfirmationPage() {
  const router = useRouter();
  const { query } = router;
  const { user } = useAuth();
  const checkoutId = typeof query.checkoutId === 'string' ? query.checkoutId : '';
  const isCancelled = query.payment === 'cancelled';
  const [cancelError, setCancelError] = useState('');
  const queryToken = typeof query.token === 'string' ? query.token : '';
  // Why: Keeps the token in memory once it is stripped from the URL, in case storage is blocked.
  const tokenRef = useRef('');
  // Why: the cancel call must run once per checkout, even when React Strict Mode re-runs the effect.
  const cancelSentForRef = useRef('');
  const [token, setToken] = useState('');
  const [tokenReady, setTokenReady] = useState(false);

  // Why: A guest's emailed link carries the token in the URL; it is stored for this tab and removed
  // from the address bar so it doesn't linger in history. The PayFast return has none and reads storage.
  useEffect(() => {
    if (!router.isReady || !checkoutId) return;
    if (queryToken) {
      tokenRef.current = queryToken;
      storeCheckoutToken({ id: checkoutId }, queryToken);
      const { token: removed, ...rest } = router.query;
      router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    }
    tokenRef.current = tokenRef.current || getOrderToken(checkoutId);
    setToken(tokenRef.current);
    setTokenReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, checkoutId, queryToken]);

  const {
    checkout,
    error: pollError,
    polling,
    timedOut,
  } = useOrderStatusPoll({
    checkoutId,
    token,
    enabled: router.isReady && tokenReady && !isCancelled,
  });
  const error = cancelError || pollError;
  const status = checkout?.status;
  const orders = checkout?.orders || [];
  // Why: A late payment puts the whole checkout under review, so one late order is enough to say so.
  const isLate = orders.some((order) => order.status === 'late_payment');
  const { clearCart } = useCart();

  // Why: A guest's token opens every order in the checkout, so once the orders are known it is
  // stored under each order id for the order and refund pages.
  useEffect(() => {
    if (checkout?.id && tokenRef.current) storeCheckoutToken(checkout, tokenRef.current);
  }, [checkout]);

  // Why: empty the cart only once payment is confirmed (checkout paid, including late orders the team
  // will resolve), so a cancelled or failed PayFast attempt keeps the buyer's items.
  useEffect(() => {
    if (status === 'paid') {
      clearCart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  const isFailed = isCancelled || (status !== undefined && FAILED_STATUSES.includes(status));
  const isConfirming =
    !isCancelled &&
    !error &&
    Boolean(checkoutId) &&
    (!checkout || (status === 'pending_payment' && polling));
  const stillPending = !isCancelled && status === 'pending_payment' && timedOut;
  const isAmber = isFailed || isConfirming || isLate || stillPending;
  /**
   * Why: Links an order to the signed-in view or to the guest view.
   * @param orderId - The order ID.
   * @returns The order URL.
   */
  const orderHref = (orderId: string): string =>
    user ? `/profile/orders/${orderId}` : `/order/${orderId}`;
  const lateCopy = getPaymentStepCopy('late_payment');

  let heading = 'Order placed!';
  if (isCancelled) heading = 'Payment cancelled';
  else if (isFailed) heading = 'Payment unsuccessful';
  else if (isConfirming) heading = 'Confirming your payment…';
  else if (isLate) heading = lateCopy.label;
  else if (stillPending) heading = 'Payment still being confirmed';

  useEffect(() => {
    if (!router.isReady || !tokenReady || !checkoutId || !isCancelled) {
      return;
    }
    if (cancelSentForRef.current === checkoutId) {
      return;
    }
    cancelSentForRef.current = checkoutId;

    cancelCheckout(checkoutId, tokenRef.current).catch((err) => {
      // A cancel that hits a checkout that is no longer pending payment is harmless to the buyer.
      if (isApiProblem(err) && err.code === 'ORDER_NOT_PAYABLE') {
        return;
      }
      reportError('order-confirmation', err);
      setCancelError(toUserMessage(err, "We couldn't load your order details. Please try again."));
    });
  }, [router.isReady, tokenReady, isCancelled, checkoutId]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full ${isAmber ? 'bg-amber-100' : 'bg-emerald-100'}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          className="text-emerald-600"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{heading}</h1>
        {isCancelled ? (
          <p className="mt-3 text-sm text-slate-600">
            Your stock reservation has been released. You can return to checkout whenever you are
            ready.
          </p>
        ) : null}
        {!isCancelled && isFailed ? (
          <p className="mt-3 text-sm text-slate-600">
            Your payment did not go through and you have not been charged. You can return to
            checkout to try again.
          </p>
        ) : null}
        {isLate ? <p className="mt-3 text-sm text-slate-600">{lateCopy.sublabel}</p> : null}
        {stillPending ? (
          <p className="mt-3 text-sm text-slate-600">
            Your payment is still being confirmed. We&apos;ll email you once it&apos;s done.
          </p>
        ) : null}
        {checkout && !isCancelled && !isFailed && !isLate && !stillPending && !isConfirming ? (
          <p className="mt-3 text-sm text-slate-600">Your payment was received.</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {checkoutId ? (
          <p className="mt-3 text-xs text-slate-400">
            Checkout reference: <span className="font-mono">{checkoutId}</span>
          </p>
        ) : null}
        {orders.length > 0 && !isFailed && !isConfirming ? (
          <ul className="mt-4 space-y-2">
            {orders.map((order) => (
              <li key={order.id} className="text-sm text-slate-600">
                {order.seller?.name}: {order.statusLabel}{' '}
                <Link href={orderHref(order.id)} className="font-semibold text-slate-900 underline">
                  View order
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        {isFailed ? (
          <Link
            href="/checkout"
            className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Back to checkout
          </Link>
        ) : null}
        <Link
          href="/shop"
          className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Continue shopping
        </Link>
        <Link
          href="/"
          className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400"
        >
          Go to home
        </Link>
      </div>
    </div>
  );
}
