import { useEffect, useMemo, useState } from 'react';
import useAuth from '../../lib/useAuth';
import {
  fetchAllOrdersForAdmin,
  fetchLiveProducts,
  updateProductStatusAsAdmin,
} from '../../lib/firestoreHelpers';

const STATUS_BUCKETS = [
  { value: 'listed', label: 'Listed' },
  { value: 'purchased', label: 'Purchased' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'refunded', label: 'Refunded' },
];

function normalizeStatus(product) {
  if (product.status) {
    return String(product.status).toLowerCase();
  }

  return product.marketSold ? 'purchased' : 'listed';
}

function getProductUpdatedTime(product) {
  const value = product.statusUpdatedAt || product.updatedAt || product.createdAt;

  if (typeof value?.toDate === 'function') {
    return value.toDate().getTime();
  }

  if (typeof value?.seconds === 'number') {
    return value.seconds * 1000;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
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
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [draggedProduct, setDraggedProduct] = useState(null);
  const [movingProductId, setMovingProductId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      return;
    }

    Promise.all([
      fetchLiveProducts({ includeAllStatuses: true }),
      fetchAllOrdersForAdmin(),
    ])
      .then(([productRows, orderRows]) => {
        setProducts(productRows || []);
        setOrders(orderRows || []);
      })
      .catch((err) => setError(err?.message || 'Failed to load sales data.'));
  }, [user, profile?.role]);

  const orderMatchesByProductId = useMemo(() => {
    const matches = new Map();
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (!item.productId) {
          return;
        }

        const current = matches.get(item.productId) || [];
        current.push({
          orderId: order.id,
          quantity: item.quantity,
          orderStatus: order.status,
          buyerId: order.buyerId || '',
          buyerName: getBuyerName(order),
          buyerEmail: order.buyerEmail || '',
          buyerPhone: order.shippingAddress?.phone || '',
          shippingAddress: order.shippingAddress || {},
        });
        matches.set(item.productId, current);
      });
    });
    return matches;
  }, [orders]);

  const productRows = useMemo(() => products.map((product) => ({
    ...product,
    salesStatus: normalizeStatus(product),
    orderMatches: orderMatchesByProductId.get(product.id) || [],
  })), [products, orderMatchesByProductId]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return productRows;
    }

    return productRows.filter((product) => {
      const values = [
        product.id,
        product.sellerId,
        product.sellerEmail,
        product.name,
        product.category,
        product.subcategory,
        product.orderId,
        product.soldOrderId,
        ...product.orderMatches.map((match) => match.orderId),
      ];
      return values.some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [productRows, searchTerm]);

  const productsByStatus = useMemo(() => {
    const grouped = Object.fromEntries(STATUS_BUCKETS.map((bucket) => [bucket.value, []]));
    filteredProducts.forEach((product) => {
      const bucket = grouped[product.salesStatus] || grouped.listed;
      bucket.push(product);
    });
    Object.values(grouped).forEach((bucket) => {
      bucket.sort((a, b) => getProductUpdatedTime(b) - getProductUpdatedTime(a));
    });
    return grouped;
  }, [filteredProducts]);

  const moveProduct = async (product, status) => {
    if (!product || product.salesStatus === status) {
      return;
    }

    setMovingProductId(product.id);
    setError('');
    try {
      await updateProductStatusAsAdmin(product.id, status);
      setProducts((currentProducts) => currentProducts.map((currentProduct) => (
        currentProduct.id === product.id
          ? { ...currentProduct, status, statusUpdatedAt: new Date() }
          : currentProduct
      )));
    } catch (err) {
      setError(err?.message || 'Failed to move product.');
    } finally {
      setMovingProductId('');
      setDraggedProduct(null);
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
        <p className="mt-2 text-slate-600">Move products between status buckets to manage the sales pipeline.</p>
      </div>

      <label className="block">
        <span className="sr-only">Search products</span>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by product ID, seller ID, or order ID"
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-[#00C5CD] focus:outline-none focus:ring-2 focus:ring-[#00C5CD]/20"
        />
      </label>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUS_BUCKETS.map((bucket) => (
          <section
            key={bucket.value}
            className="min-w-[280px] flex-1 rounded-2xl border border-slate-200 bg-slate-100 p-3"
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => moveProduct(draggedProduct, bucket.value)}
          >
            <div className="flex items-center justify-between px-2 pb-3">
              <h2 className="font-semibold text-slate-900">{bucket.label}</h2>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                {productsByStatus[bucket.value].length}
              </span>
            </div>
            <div className="space-y-3">
              {productsByStatus[bucket.value].map((product) => (
                <article
                  key={product.id}
                  draggable
                  onDragStart={() => setDraggedProduct(product)}
                  onClick={() => setSelectedProduct(product)}
                  className="cursor-grab rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#00C5CD] active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">{product.name || 'Untitled product'}</h3>
                    {movingProductId === product.id ? <span className="text-xs text-slate-500">Saving...</span> : null}
                  </div>
                  <dl className="mt-3 space-y-1 text-xs text-slate-600">
                    <div><dt className="inline font-semibold">Product ID: </dt><dd className="inline break-all">{product.id}</dd></div>
                    <div><dt className="inline font-semibold">Category: </dt><dd className="inline">{product.category || 'Uncategorized'}</dd></div>
                    <div><dt className="inline font-semibold">Subcategory: </dt><dd className="inline">{product.subcategory || 'None'}</dd></div>
                    {product.orderMatches.length > 0 ? (
                      <>
                        <div><dt className="inline font-semibold">Order ID: </dt><dd className="inline break-all">{product.orderMatches[0].orderId}</dd></div>
                        <div><dt className="inline font-semibold">Buyer: </dt><dd className="inline">{product.orderMatches[0].buyerName}</dd></div>
                      </>
                    ) : null}
                  </dl>
                  <select
                    value={product.salesStatus}
                    onChange={(event) => {
                      event.stopPropagation();
                      moveProduct(product, event.target.value);
                    }}
                    onClick={(event) => event.stopPropagation()}
                    className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                    aria-label={`Move ${product.name || 'product'} to another status`}
                  >
                    {STATUS_BUCKETS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </article>
              ))}
              {productsByStatus[bucket.value].length === 0 ? <p className="px-2 py-6 text-center text-xs text-slate-500">No products</p> : null}
            </div>
          </section>
        ))}
      </div>

      {selectedProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6" onClick={() => setSelectedProduct(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00C5CD]">Product information</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedProduct.name || 'Untitled product'}</h2>
              </div>
              <button type="button" onClick={() => setSelectedProduct(null)} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1]">Close</button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {Object.entries(selectedProduct)
                .filter(([key]) => key !== 'orderMatches' && key !== 'salesStatus')
                .map(([key, value]) => (
                  <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{key}</p>
                    <p className="mt-1 break-words text-sm text-slate-900">{formatValue(value) || 'Not provided'}</p>
                  </div>
                ))}
            </div>
            {selectedProduct.orderMatches.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-semibold text-slate-900">Related orders</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {selectedProduct.orderMatches.map((match) => (
                    <li key={match.orderId} className="border-b border-slate-200 py-3 last:border-0">
                      <p className="font-semibold">Order {match.orderId}</p>
                      <p>{match.quantity || 1} unit(s) · {match.orderStatus || 'Unknown status'}</p>
                      <p className="mt-2"><span className="font-semibold">Buyer:</span> {match.buyerName}</p>
                      <p><span className="font-semibold">Email:</span> {match.buyerEmail || 'Not provided'}</p>
                      <p><span className="font-semibold">Phone:</span> {match.buyerPhone || 'Not provided'}</p>
                      <p><span className="font-semibold">Shipping address:</span> {getShippingAddressLabel(match.shippingAddress)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
