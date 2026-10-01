import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import useAuth from '@/lib/useAuth';
import OrderDetail from './OrderDetail';
import { getOrderToken, storeOrderToken } from '@/lib/api/orders';
import { useOrder } from '@/lib/queries/orders';
import { toUserMessage } from '@/lib/userMessage';

/**
 * Why: The page the confirmation email links to (`/order/{orderId}?token={accessToken}`) so a
 * guest can view their order. The token is stored for the tab and stripped from the URL.
 * @returns The order detail, or a loading, error or "open from email" state.
 * @example
 * // Rendered at /order/<orderId>?token=<accessToken>
 * <GuestOrderPage />
 */
export default function GuestOrderPage() {
  const router = useRouter();
  const { orderId: queryOrderId, token: queryToken } = router.query;
  const orderId = typeof queryOrderId === 'string' ? queryOrderId : '';
  const { user, loading: authLoading } = useAuth();
  const queryTokenValue = typeof queryToken === 'string' ? queryToken : '';
  // Why: Keeps the token in memory once it is stripped from the URL, in case storage is blocked.
  const [heldToken, setHeldToken] = useState('');
  if (queryTokenValue && queryTokenValue !== heldToken) setHeldToken(queryTokenValue);
  const ready = router.isReady && Boolean(orderId) && !authLoading;
  const token = queryTokenValue || heldToken || (ready ? getOrderToken(orderId) : '');
  const missingToken = ready && !user && !token;
  const {
    data: order,
    isPending,
    isError,
    error,
  } = useOrder(ready && !missingToken ? orderId : '', token);

  useEffect(() => {
    if (!ready || !queryTokenValue) return;
    storeOrderToken(orderId, queryTokenValue);
    router.replace({ pathname: '/order/[orderId]', query: { orderId } }, `/order/${orderId}`, {
      shallow: true,
    });
  }, [ready, orderId, queryTokenValue, router]);

  if (!ready || (!missingToken && isPending)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">Loading order…</p>
      </div>
    );
  }

  if (missingToken) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">
          Open this order from the link in your email
        </h1>
        <p className="text-slate-600">
          For your security, guest orders can only be viewed using the link in your order
          confirmation email.
        </p>
        <Link
          href="/login"
          className="inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Sign in instead
        </Link>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <p className="text-red-600">
          {toUserMessage(error, "We couldn't load this order. Please try again.")}
        </p>
      </div>
    );
  }

  if (!order) return null;

  return <OrderDetail order={order} refundHref={`/order/${order.id}/return`} />;
}
