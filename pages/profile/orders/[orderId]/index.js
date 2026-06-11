import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import useAuth from '../../../../lib/useAuth';
import { fetchOrderById } from '../../../../lib/firestoreHelpers';

function formatDate(ts) {
  if (!ts) return null;
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

const TIMELINE_STEPS = [
  {
    key: 'purchased',
    label: 'Payment Confirmed',
    sublabel: 'Your payment was received and the order is being prepared.',
    dateField: 'paidAt',
  },
  {
    key: 'shipped',
    label: 'Shipped',
    sublabel: 'Your order is on its way.',
    dateField: 'shippedAt',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    sublabel: 'Your order has been delivered.',
    dateField: 'deliveredAt',
  },
];

const STEP_ORDER = ['purchased', 'shipped', 'delivered'];

function resolvedStepIndex(status) {
  const s = (status || '').toLowerCase();
  if (s === 'delivered') return 2;
  if (s === 'shipped') return 1;
  if (s === 'paid' || s === 'purchased') return 0;
  return -1;
}

function CheckIcon() {
  return (
    <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

export default function OrderDetailPage() {
  const router = useRouter();
  const { orderId } = router.query;
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId || authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    fetchOrderById(orderId)
      .then(setOrder)
      .catch((err) => setError(err.message || 'Failed to load order.'))
      .finally(() => setLoading(false));
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

  const completedIdx = resolvedStepIndex(order.status);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">

      {/* Back */}
      <div>
        <Link
          href="/profile/orders"
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          My Orders
        </Link>
      </div>

      {/* Order heading */}
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Order details</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Order #{order.id.slice(-8).toUpperCase()}
        </h1>
        <p className="mt-0.5 font-mono text-xs text-slate-400">{order.id}</p>
      </div>

      {/* Product cards */}
      <div className="space-y-6">
        {(order.items || []).map((item, idx) => {
          const product = item.product;
          const images = product?.images?.length
            ? product.images
            : product?.primaryImage
              ? [product.primaryImage]
              : item.primaryImage
                ? [item.primaryImage]
                : [];
          const specs = Array.isArray(product?.specifications) ? product.specifications : [];
          const description = product?.description || '';
          const category = product?.category || '';

          const isGear = (category || '').toLowerCase() === 'gear';
          const legacyMatch = description.match(
            /Condition:\s*([^.]+)\.\s*Brand:\s*([^.]+)\.\s*Size:\s*([^.]+)\.?/i
          );
          const derivedCondition = (product?.gearCondition || legacyMatch?.[1] || '').trim();
          const derivedBrand = (product?.gearBrand || legacyMatch?.[2] || '').trim();
          const derivedSize = (product?.gearSize || legacyMatch?.[3] || '').trim();
          const hasCondition = specs.some((s) => /^condition\s*:/i.test(s));
          const hasBrand = specs.some((s) => /^brand\s*:/i.test(s));
          const hasSize = specs.some((s) => /^size\s*:/i.test(s));
          const displaySpecs = isGear
            ? [
                ...specs,
                ...(derivedCondition && !hasCondition ? [`Condition: ${derivedCondition}`] : []),
                ...(derivedBrand && !hasBrand ? [`Brand: ${derivedBrand}`] : []),
                ...(derivedSize && !hasSize ? [`Size: ${derivedSize}`] : []),
              ]
            : specs;
          const displayDescription = isGear && legacyMatch ? '' : description;

          return (
            <div
              key={idx}
              className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.2fr_0.8fr]"
            >
              {/* Images + info */}
              <div className="space-y-4">
                {images.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {images.slice(0, 4).map((src, i) => (
                      <div key={i} className="aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
                        <img src={src} alt={`${item.name} ${i + 1}`} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                {category && (
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{category}</p>
                )}
                <h2 className="text-2xl font-semibold text-slate-900">{item.name}</h2>
                {displayDescription && (
                  <p className="text-slate-600 leading-relaxed">{displayDescription}</p>
                )}
                {displaySpecs.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-base font-semibold text-slate-900">Specifications</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {displaySpecs.map((s) => <li key={s}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              {/* Price panel */}
              <aside className="self-start space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Unit price</p>
                  <p className="mt-1 text-3xl font-semibold text-slate-900">
                    R{Number(item.price).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Quantity</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{item.quantity}</p>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Subtotal</p>
                  <p className="mt-1 text-xl font-semibold text-[#00CED1]">
                    R{(Number(item.price) * Number(item.quantity)).toFixed(2)}
                  </p>
                </div>
              </aside>
            </div>
          );
        })}
      </div>

      {/* Order total row */}
      <div className="flex justify-end rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Order total</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            R{Number(order.totalAmount || 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Status timeline */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-base font-semibold text-slate-900">Order status</h2>
        <ol className="relative ml-3 space-y-8 border-l-2 border-slate-200">
          {TIMELINE_STEPS.map((step, stepIdx) => {
            const isCompleted = completedIdx >= stepIdx;
            const isActive = completedIdx === stepIdx;
            const dateStr = formatDate(order[step.dateField]);

            return (
              <li key={step.key} className="ml-6">
                {/* Dot */}
                <span
                  className={`absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                    isCompleted
                      ? 'border-[#00CED1] bg-[#00CED1]'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {isCompleted && <CheckIcon />}
                </span>

                <div>
                  <p
                    className={`text-sm font-semibold ${
                      isCompleted ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                    {isActive && (
                      <span className="ml-2 inline-block rounded-full bg-[#00CED1]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#00CED1]">
                        Current
                      </span>
                    )}
                  </p>
                  <p className={`mt-0.5 text-xs ${isCompleted ? 'text-slate-500' : 'text-slate-300'}`}>
                    {step.sublabel}
                  </p>
                  {dateStr ? (
                    <p className="mt-1 text-xs font-medium text-slate-500">{dateStr}</p>
                  ) : isCompleted ? (
                    <p className="mt-1 text-xs text-slate-400">Date unavailable</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-300">Pending</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Return CTA — only visible once delivered */}
      {order.status === 'delivered' && (
        <div className="flex justify-end">
          <Link
            href={`/profile/orders/${order.id}/return`}
            className="rounded-full bg-rose-600 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Request Return
          </Link>
        </div>
      )}
    </div>
  );
}
