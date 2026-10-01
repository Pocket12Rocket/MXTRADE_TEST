import { useEffect, useState } from 'react';
import useAuth from '../../lib/useAuth';
import { listMyOrders, orderStatusColour } from '../../lib/api/orders';
import Link from 'next/link';
import Image from 'next/image';
import { toUserMessage } from '../../lib/userMessage';

const ORDERS_PAGE_SIZE = 20;

/**
 * Why: Buyer's "My orders" page, read from the backend (`GET /me/orders`) one cursor page at a
 * time; a "Load more" control fetches the next page with `nextCursor`. Status text comes from the
 * API's `statusLabel`; only the badge colour is decided here.
 * @returns {JSX.Element} The order list, a sign-in prompt, or a loading state.
 */
export default function OrdersPage() {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState('');
  const [ordersCursor, setOrdersCursor] = useState(null);
  const [hasMoreOrders, setHasMoreOrders] = useState(false);
  const [isLoadingMoreOrders, setIsLoadingMoreOrders] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      listMyOrders({ limit: ORDERS_PAGE_SIZE })
        .then(({ items, nextCursor }) => {
          setOrders(items);
          setOrdersCursor(nextCursor);
          setHasMoreOrders(Boolean(nextCursor));
        })
        .catch((err) => {
          setError(toUserMessage(err, "We couldn't load your orders right now. Please try again."));
        })
        .finally(() => setOrdersLoading(false));
    } else {
      setOrdersLoading(false);
    }
  }, [user, loading]);

  /**
   * Why: Fetches the next page of the buyer's orders using the `nextCursor` of the previous page.
   * @returns {Promise<void>} Resolves once the next page has been appended to state.
   * @example
   * <button onClick={handleLoadMoreOrders}>Load more orders</button>
   */
  const handleLoadMoreOrders = async () => {
    if (!ordersCursor || isLoadingMoreOrders || !user) {
      return;
    }

    setIsLoadingMoreOrders(true);
    try {
      const { items, nextCursor } = await listMyOrders({ cursor: ordersCursor, limit: ORDERS_PAGE_SIZE });
      setOrders((currentOrders) => [...currentOrders, ...items]);
      setOrdersCursor(nextCursor);
      setHasMoreOrders(Boolean(nextCursor));
    } catch (err) {
      setError(toUserMessage(err, "We couldn't load more orders right now. Please try again."));
    } finally {
      setIsLoadingMoreOrders(false);
    }
  };

  if (loading || ordersLoading) {
    return <div className="flex justify-center items-center min-h-[40vh]"><p>Loading orders...</p></div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-16 p-8 rounded-3xl border border-slate-200 bg-white shadow-sm text-center">
        <h1 className="text-2xl font-semibold mb-4">Sign in to view your orders</h1>
        <p className="mb-6 text-slate-600">Please <Link href="/login" className="text-[#00CED1] underline">log in</Link> or <Link href="/register" className="text-[#00CED1] underline">register</Link> to view your orders.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto mt-8 p-4 sm:p-8 rounded-3xl border border-slate-200 bg-white shadow-sm">
      <h1 className="text-2xl font-semibold mb-6">My Orders</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {orders.length === 0 ? (
        <p className="text-slate-600">No orders found for your account.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {orders.map((order, idx) => {
            const badgeLabel = order.statusLabel || order.status;
            const firstItem = order.items?.[0];
            const productName = firstItem?.name || `Order #${order.id.slice(-8).toUpperCase()}`;
            const imageUrl = firstItem?.thumbnailUrl || '';
            const badgeColour = orderStatusColour(order.status);
            return (
              <li key={`${order.id}-${idx}`} className="py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                {/* Clickable product info */}
                <Link
                  href={`/profile/orders/${order.id}`}
                  className="flex flex-1 items-center gap-4 rounded-2xl hover:bg-slate-50 transition p-2 -m-2"
                >
                  {imageUrl && (
                    <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                      <Image src={imageUrl} alt={productName} width={64} height={64} className="object-cover w-full h-full" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{productName}</p>
                    <p className="text-slate-500 text-xs mt-0.5 font-mono truncate">#{order.id}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}</p>
                    <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${badgeColour}`}>
                      {badgeLabel}
                    </span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="ml-auto flex-shrink-0 text-slate-300" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                {/* Return action */}
                <div className="flex-shrink-0 flex justify-end sm:justify-start">
                  <button
                    className={`rounded-full px-5 py-2 text-sm font-semibold text-white ${order.canRequestRefund ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    disabled={!order.canRequestRefund}
                    onClick={() => window.location.href = `/profile/orders/${order.id}/return`}
                  >
                    Return
                  </button>
                  {(order.canConfirmDelivery || order.canReportNotArrived) && (
                    <Link href={`/profile/orders/${order.id}`} className="ml-3 self-center text-xs font-semibold text-[#00C5CD] underline">
                      {order.canConfirmDelivery ? 'Confirm delivery' : 'Report not arrived'}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hasMoreOrders ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMoreOrders}
            disabled={isLoadingMoreOrders}
            className="rounded-full border border-slate-300 bg-white px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm hover:border-[#00CED1] hover:text-[#00C5CD] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMoreOrders ? 'Loading…' : 'Load more orders'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
