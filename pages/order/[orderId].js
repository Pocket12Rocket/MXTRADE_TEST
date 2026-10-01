import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import useAuth from '../../lib/useAuth';
import OrderDetail from '../../components/OrderDetail';
import { getOrder, getOrderToken, storeOrderToken } from '../../lib/api/orders';
import { toUserMessage } from '../../lib/userMessage';

/**
 * Why: The page the confirmation email links to (`/order/{orderId}?token={accessToken}`) so a
 * guest can view their order. The token is stored for the tab and stripped from the URL.
 * @returns {JSX.Element} The order detail, or a loading, error or "open from email" state.
 * @example
 * // Rendered at /order/<orderId>?token=<accessToken>
 * <GuestOrderPage />
 */
export default function GuestOrderPage() {
  const router = useRouter();
  const { orderId, token: queryToken } = router.query;
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Why: Keeps the token in memory once it is stripped from the URL, in case storage is blocked.
  const tokenRef = useRef('');

  useEffect(() => {
    if (!router.isReady || !orderId || authLoading) return;
    if (typeof queryToken === 'string' && queryToken) {
      tokenRef.current = queryToken;
      storeOrderToken(orderId, queryToken);
      router.replace({ pathname: '/order/[orderId]', query: { orderId } }, `/order/${orderId}`, { shallow: true });
    }
    const token = tokenRef.current || getOrderToken(orderId);
    tokenRef.current = token;
    if (!user && !token) {
      setLoading(false);
      return;
    }

    getOrder(orderId, token)
      .then(setOrder)
      .catch((err) => setError(toUserMessage(err, "We couldn't load this order. Please try again.")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, orderId, user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">Loading order…</p>
      </div>
    );
  }

  if (!user && !tokenRef.current) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Open this order from the link in your email</h1>
        <p className="text-slate-600">
          For your security, guest orders can only be viewed using the link in your order confirmation email.
        </p>
        <Link href="/login" className="inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          Sign in instead
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!order) return null;

  return <OrderDetail order={order} refundHref={`/order/${order.id}/return`} />;
}
