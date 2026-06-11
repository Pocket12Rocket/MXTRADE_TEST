import { useEffect, useState } from 'react';
import useAuth from '../../lib/useAuth';
import { fetchUserOrders } from '../../lib/firestoreHelpers';
import Link from 'next/link';
import Image from 'next/image';

const STATUS_LABEL = {
  purchased: 'Purchased',
  paid: 'Purchased',
  shipped: 'Shipped',
  delivered: 'Delivered',
  refund_pending: 'Refund Pending',
  refunded: 'Refunded',
};

const STATUS_COLOUR = {
  purchased: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-700',
  shipped: 'bg-blue-100 text-blue-700',
  delivered: 'bg-slate-100 text-slate-700',
  refund_pending: 'bg-amber-100 text-amber-700',
  refunded: 'bg-rose-100 text-rose-700',
};

export default function OrdersPage() {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && user) {
      fetchUserOrders(user.email)
        .then(setOrders)
        .catch((err) => setError(err.message || 'Failed to fetch orders.'))
        .finally(() => setOrdersLoading(false));
    } else {
      setOrdersLoading(false);
    }
  }, [user, loading]);

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
            const statusKey = (order.status || '').toLowerCase();
            const badgeLabel = STATUS_LABEL[statusKey] || order.status;
            const badgeColour = STATUS_COLOUR[statusKey] || 'bg-slate-100 text-slate-700';
            return (
              <li key={`${order.id}-${idx}`} className="py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                {/* Clickable product info */}
                <Link
                  href={`/profile/orders/${order.id}`}
                  className="flex flex-1 items-center gap-4 rounded-2xl hover:bg-slate-50 transition p-2 -m-2"
                >
                  {order.imageUrl && (
                    <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                      <Image src={order.imageUrl} alt={order.productName} width={64} height={64} className="object-cover w-full h-full" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{order.productName}</p>
                    <p className="text-slate-500 text-xs mt-0.5 font-mono truncate">#{order.id}</p>
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
                    className={`rounded-full px-5 py-2 text-sm font-semibold text-white ${order.status === 'delivered' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    disabled={order.status !== 'delivered'}
                    onClick={() => window.location.href = `/profile/orders/${order.id}/return`}
                  >
                    Return
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
