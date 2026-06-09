import { useEffect, useState } from 'react';
import useAuth from '../../lib/useAuth';
import { fetchUserOrders } from '../../lib/firestoreHelpers';
import Link from 'next/link';
import Image from 'next/image';

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
          {orders.map((order) => (
            <li key={order.id} className="py-6 flex flex-col md:flex-row md:items-center md:gap-6">
              <div className="flex-1 flex items-center gap-4">
                {order.imageUrl && (
                  <div className="w-20 h-20 flex-shrink-0 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                    <Image src={order.imageUrl} alt={order.productName} width={80} height={80} className="object-cover w-full h-full" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-slate-900">{order.productName}</p>
                  <p className="text-slate-600 text-sm">Order ID: {order.id}</p>
                  <p className="text-slate-500 text-xs">Status: <span className="font-semibold">{order.status}</span></p>
                </div>
              </div>
              <div className="mt-4 md:mt-0 flex flex-col gap-2 items-end">
                <button
                  className={`rounded-full px-5 py-2 text-sm font-semibold text-white ${order.status === 'delivered' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-400 cursor-not-allowed'}`}
                  disabled={order.status !== 'delivered'}
                  onClick={() => window.location.href = `/profile/orders/${order.id}/return`}
                >
                  Return
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
