import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { cancelOrder, getOrder, getOrderToken } from '../../lib/api/orders';
import { reportError, toUserMessage } from '../../lib/userMessage';

/**
 * Why: Where PayFast returns the buyer. On a cancelled payment it releases the stock hold with the
 * stored order token; otherwise it loads the order from the backend so the page shows the real
 * status (payment is confirmed by PayFast's server-to-server notification, so the order may still
 * be `pending_payment` for a moment). Errors go through `toUserMessage()`.
 * @returns {JSX.Element} The confirmation or cancelled state.
 * @example
 * // Rendered at /order/confirmation?orderId=<uuid>&payment=cancelled
 * <OrderConfirmationPage />
 */
export default function OrderConfirmationPage() {
  const router = useRouter();
  const { query } = router;
  const orderId = typeof query.orderId === 'string' ? query.orderId : '';
  const isCancelled = query.payment === 'cancelled';
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!router.isReady || !orderId) {
      return;
    }

    const token = getOrderToken(orderId);
    const request = isCancelled ? cancelOrder(orderId, token) : getOrder(orderId, token).then(setOrder);
    request.catch((err) => {
      // A cancel that hits an order that is no longer pending payment is harmless to the buyer.
      if (isCancelled && err?.code === 'ORDER_NOT_PAYABLE') {
        return;
      }
      reportError('order-confirmation', err);
      setError(toUserMessage(err, "We couldn't load your order details. Please try again."));
    });
  }, [router.isReady, isCancelled, orderId]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className={`flex h-16 w-16 items-center justify-center rounded-full ${isCancelled ? 'bg-amber-100' : 'bg-emerald-100'}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-emerald-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{isCancelled ? 'Payment cancelled' : 'Order placed!'}</h1>
        {isCancelled ? <p className="mt-3 text-sm text-slate-600">Your stock reservation has been released. You can return to checkout whenever you are ready.</p> : null}
        {!isCancelled && order ? <p className="mt-3 text-sm text-slate-600">Status: {order.statusLabel}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {orderId ? (
          <p className="mt-3 text-xs text-slate-400">Order reference: <span className="font-mono">{orderId}</span></p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/shop" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">
          Continue shopping
        </Link>
        <Link href="/" className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400">
          Go to home
        </Link>
      </div>
    </div>
  );
}
