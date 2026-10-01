import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import useAuth from '../../../../lib/useAuth';
import OrderDetail from '../../../../components/OrderDetail';
import { getOrder, getOrderToken } from '../../../../lib/api/orders';
import { toUserMessage } from '../../../../lib/userMessage';

/**
 * Why: Buyer's order detail from the backend (`GET /orders/{id}`). Signed-in buyers use their
 * session; a guest's stored order token is sent when present. Refund photos are private, so they
 * use plain `<img>`, never `next/image`.
 * @returns {JSX.Element} The order detail, or a loading/error state.
 * @example
 * // Rendered at /profile/orders/<orderId>
 * <OrderDetailPage />
 */
export default function OrderDetailPage() {
  const router = useRouter();
  const { orderId } = router.query;
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId || authLoading) return;
    const token = getOrderToken(orderId);
    if (!user && !token) {
      router.replace('/login');
      return;
    }

    getOrder(orderId, token)
      .then(setOrder)
      .catch((err) => setError(toUserMessage(err, "We couldn't load this order. Please try again.")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">Loading order…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <p className="text-red-600">{error}</p>
        <Link href="/profile/orders" className="inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          ← Back to orders
        </Link>
      </div>
    );
  }

  if (!order) return null;

  return (
    <OrderDetail
      order={order}
      refundHref={`/profile/orders/${order.id}/return`}
      backHref="/profile/orders"
      backLabel="My Orders"
    />
  );
}
