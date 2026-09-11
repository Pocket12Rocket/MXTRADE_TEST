import { useEffect, useMemo, useState } from 'react';
import useAuth from '../../lib/useAuth';
import {
  fetchAllOrdersForAdmin,
  updateOrderStatusAsAdmin,
} from '../../lib/firestoreHelpers';

const STATUS_BUCKETS = [
  { value: 'paid', label: 'Paid / Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'refund_pending', label: 'Refund Pending' },
  { value: 'refunded', label: 'Refunded' },
];

// Orders in these states haven't been paid for yet and shouldn't clutter the fulfillment board.
const HIDDEN_ORDER_STATUSES = new Set(['pending_payment', 'payment_failed', 'failed', 'cancelled']);

// Only these buckets represent manual fulfillment steps an admin can drag an order into.
const DRAGGABLE_STATUSES = new Set(['paid', 'shipped', 'delivered']);

function getOrderUpdatedTime(order) {
  const value = order.statusUpdatedAt || order.paidAt || order.createdAt;

  if (typeof value?.toDate === 'function') {
    return value.toDate().getTime();
  }

  if (typeof value?.seconds === 'number') {
    return value.seconds * 1000;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return 0;
}

function formatValue(value) {
  if (!value) {
    return '';
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().toLocaleString();
  }

  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000).toLocaleString();
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function getBuyerName(order) {
  const address = order.shippingAddress || {};
  return `${address.firstName || ''} ${address.lastName || ''}`.trim() || 'Name not provided';
}

function getShippingAddressLabel(address = {}) {
  return [
    address.streetAddress,
    address.suburb,
    address.city,
    address.province,
    address.postalCode,
  ].filter(Boolean).join(', ') || 'Shipping address not provided';
}

export default function SalesPage() {
  const { user, profile, loading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [movingOrderId, setMovingOrderId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      return;
    }

    fetchAllOrdersForAdmin()
      .then((orderRows) => setOrders((orderRows || []).filter((order) => !HIDDEN_ORDER_STATUSES.has(order.status))))
      .catch((err) => setError(err?.message || 'Failed to load sales data.'));
  }, [user, profile?.role]);

  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return orders;
    }

    return orders.filter((order) => {
      const values = [
        order.id,
        order.buyerEmail,
        ...(order.items || []).map((item) => item.productId),
        ...(order.items || []).map((item) => item.sellerId),
      ];
      return values.some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [orders, searchTerm]);

  const ordersByStatus = useMemo(() => {
    const grouped = Object.fromEntries(STATUS_BUCKETS.map((bucket) => [bucket.value, []]));
    filteredOrders.forEach((order) => {
      const bucket = grouped[order.status] || grouped.paid;
      bucket.push(order);
    });
    Object.values(grouped).forEach((bucket) => {
      bucket.sort((a, b) => getOrderUpdatedTime(b) - getOrderUpdatedTime(a));
    });
    return grouped;
  }, [filteredOrders]);

  const moveOrder = async (order, status) => {
    if (!order || order.status === status || !DRAGGABLE_STATUSES.has(status) || !DRAGGABLE_STATUSES.has(order.status)) {
      return;
    }

    setMovingOrderId(order.id);
    setError('');
    try {
      await updateOrderStatusAsAdmin(order.id, status);
      setOrders((currentOrders) => currentOrders.map((currentOrder) => (
        currentOrder.id === order.id
          ? { ...currentOrder, status, statusUpdatedAt: new Date() }
          : currentOrder
      )));
    } catch (err) {
      setError(err?.message || 'Failed to move order.');
    } finally {
      setMovingOrderId('');
      setDraggedOrder(null);
    }
  };

  if (loading) {
    return <p>Loading sales board...</p>;
  }

  if (!user || profile?.role !== 'admin') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Please sign in with an admin account to access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Sales</h1>
        <p className="mt-2 text-slate-600">Drag orders between stages to track fulfillment. Refund states are managed from the refund requests panel.</p>
      </div>

      <label className="block">
        <span className="sr-only">Search orders</span>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by order ID, buyer email, product ID, or seller ID"
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-[#00C5CD] focus:outline-none focus:ring-2 focus:ring-[#00C5CD]/20"
        />
      </label>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUS_BUCKETS.map((bucket) => (
          <section
            key={bucket.value}
            className="min-w-[280px] flex-1 rounded-2xl border border-slate-200 bg-slate-100 p-3"
            onDragOver={(event) => { if (DRAGGABLE_STATUSES.has(bucket.value)) event.preventDefault(); }}
            onDrop={() => moveOrder(draggedOrder, bucket.value)}
          >
            <div className="flex items-center justify-between px-2 pb-3">
              <h2 className="font-semibold text-slate-900">{bucket.label}</h2>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                {ordersByStatus[bucket.value].length}
              </span>
            </div>
            <div className="space-y-3">
              {ordersByStatus[bucket.value].map((order) => (
                <article
                  key={order.id}
                  draggable={DRAGGABLE_STATUSES.has(order.status)}
                  onDragStart={() => setDraggedOrder(order)}
                  onClick={() => setSelectedOrder(order)}
                  className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#00C5CD] ${DRAGGABLE_STATUSES.has(order.status) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-slate-900 break-all">{order.id}</h3>
                    {movingOrderId === order.id ? <span className="text-xs text-slate-500">Saving...</span> : null}
                  </div>
                  <dl className="mt-3 space-y-1 text-xs text-slate-600">
                    <div><dt className="inline font-semibold">Buyer: </dt><dd className="inline">{getBuyerName(order)}</dd></div>
                    <div><dt className="inline font-semibold">Email: </dt><dd className="inline">{order.buyerEmail || '—'}</dd></div>
                    <div><dt className="inline font-semibold">Items: </dt><dd className="inline">{(order.items || []).map((item) => `${item.name} x${item.quantity}`).join(', ') || 'None'}</dd></div>
                    <div><dt className="inline font-semibold">Total: </dt><dd className="inline">R{Number(order.totalAmount || 0).toFixed(2)}</dd></div>
                  </dl>
                  {DRAGGABLE_STATUSES.has(order.status) ? (
                    <select
                      value={order.status}
                      onChange={(event) => {
                        event.stopPropagation();
                        moveOrder(order, event.target.value);
                      }}
                      onClick={(event) => event.stopPropagation()}
                      className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                      aria-label={`Move order ${order.id} to another status`}
                    >
                      {STATUS_BUCKETS.filter((option) => DRAGGABLE_STATUSES.has(option.value)).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : null}
                </article>
              ))}
              {ordersByStatus[bucket.value].length === 0 ? <p className="px-2 py-6 text-center text-xs text-slate-500">No orders</p> : null}
            </div>
          </section>
        ))}
      </div>

      {selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6" onClick={() => setSelectedOrder(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00C5CD]">Order information</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900 break-all">{selectedOrder.id}</h2>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1]">Close</button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">Buyer</h3>
              <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Name:</span> {getBuyerName(selectedOrder)}</p>
              <p className="text-sm text-slate-700"><span className="font-semibold">Email:</span> {selectedOrder.buyerEmail || 'Not provided'}</p>
              <p className="text-sm text-slate-700"><span className="font-semibold">Phone:</span> {selectedOrder.shippingAddress?.phone || 'Not provided'}</p>
              <p className="text-sm text-slate-700"><span className="font-semibold">Shipping address:</span> {getShippingAddressLabel(selectedOrder.shippingAddress)}</p>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">Items</h3>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {(selectedOrder.items || []).map((item, idx) => (
                  <li key={`${item.productId || idx}`} className="border-b border-slate-200 pb-2 last:border-0">
                    <p className="font-semibold">{item.name}</p>
                    <p>{item.quantity} x R{Number(item.price || 0).toFixed(2)} · Seller: {item.sellerEmail || item.sellerId || '—'}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm font-semibold text-slate-900">Total: R{Number(selectedOrder.totalAmount || 0).toFixed(2)}</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(selectedOrder)
                .filter(([key]) => !['items', 'shippingAddress', 'id'].includes(key))
                .map(([key, value]) => (
                  <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{key}</p>
                    <p className="mt-1 break-words text-sm text-slate-900">{formatValue(value) || 'Not provided'}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

