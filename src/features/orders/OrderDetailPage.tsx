import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import useAuth from '@/lib/useAuth';
import OrderDetail from './OrderDetail';
import { getOrderToken } from '@/lib/api/orders';
import { useOrder } from '@/lib/queries/orders';
import { toUserMessage } from '@/lib/userMessage';

/**
 * Why: Buyer's order detail from the backend (`GET /orders/{id}`). Signed-in buyers use their
 * session; a guest's stored order token is sent when present. Refund photos are private, so they
 * use plain `<img>`, never `next/image`.
 * @returns The order detail, or a loading/error state.
 * @example
 * // Rendered at /profile/orders/<orderId>
 * <OrderDetailPage />
 */
export default function OrderDetailPage() {
  const router = useRouter();
  const { orderId: queryOrderId } = router.query;
  const orderId = typeof queryOrderId === 'string' ? queryOrderId : '';
  const { user, loading: authLoading } = useAuth();
  const token = orderId ? getOrderToken(orderId) : '';
  const canLoad = Boolean(orderId) && !authLoading && Boolean(user || token);
  const { data: order, isPending, isError, error } = useOrder(canLoad ? orderId : '', token);

  useEffect(() => {
    if (orderId && !authLoading && !user && !token) router.replace('/login');
  }, [orderId, authLoading, user, token, router]);

  if (!canLoad || isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">Loading order…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <p className="text-red-600">
          {toUserMessage(error, "We couldn't load this order. Please try again.")}
        </p>
        <Link
          href="/profile/orders"
          className="inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          ← Back to orders
        </Link>
      </div>
    );
  }

  return (
    <OrderDetail
      order={order}
      refundHref={`/profile/orders/${order.id}/return`}
      backHref="/profile/orders"
      backLabel="My Orders"
    />
  );
}
