import Link from 'next/link';
import { formatRands } from '../lib/api/orders';

function formatDate(ts) {
  if (!ts) return null;
  try {
    const d = new Date(ts);
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

// Why: Text for the buyer-facing refund block, keyed by the API's `refund.status`.
const REFUND_STATUS_LABEL = {
  pending: 'Under review',
  accepted: 'Accepted, awaiting your EFT refund',
  denied: 'Denied',
  paid: 'Refunded',
};

/**
 * Why: Maps the order onto the 3-step timeline. Refund statuses only occur after delivery, so
 * they show the full timeline; statuses before payment show none.
 * @param {string} status - API order status.
 * @returns {number} Index of the last completed step, or -1.
 * @example
 * resolvedStepIndex('shipped'); // 1
 */
function resolvedStepIndex(status) {
  const s = (status || '').toLowerCase();
  if (s === 'delivered' || s === 'refund_pending' || s === 'refunded') return 2;
  if (s === 'shipped') return 1;
  if (s === 'paid' || s === 'late_payment') return 0;
  return -1;
}

function CheckIcon() {
  return (
    <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * Why: One order-detail view shared by the signed-in buyer page and the guest (emailed link)
 * page, so the items, totals, timeline and refund block are never duplicated. The refund action
 * only shows when the API says `canRequestRefund`; refund photos are private URLs, so they use
 * plain `<img>`, never `next/image`.
 * @param {object} props - Component props.
 * @param {object} props.order - Order from `GET /orders/{id}`.
 * @param {string} props.refundHref - Where the "Request refund" link goes (differs for guests).
 * @param {string} [props.backHref] - Optional back link target; omitted for guests.
 * @param {string} [props.backLabel] - Label for the back link.
 * @returns {JSX.Element} The order detail.
 * @example
 * <OrderDetail order={order} refundHref={`/profile/orders/${order.id}/return`} backHref="/profile/orders" backLabel="My Orders" />
 */
export default function OrderDetail({ order, refundHref, backHref, backLabel }) {
  const completedIdx = resolvedStepIndex(order.status);
  const refund = order.refund;
  const deadline = formatDate(order.refundDeadline);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">

      {/* Back */}
      {backHref && (
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {backLabel}
          </Link>
        </div>
      )}

      {/* Order heading */}
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Order details</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Order #{order.id.slice(-8).toUpperCase()}
        </h1>
        <p className="mt-0.5 font-mono text-xs text-slate-400">{order.id}</p>
        <p className="mt-2 text-sm font-semibold text-slate-700">{order.statusLabel}</p>
      </div>

      {/* Product cards */}
      <div className="space-y-6">
        {(order.items || []).map((item, idx) => (
          <div
            key={idx}
            className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.2fr_0.8fr]"
          >
            {/* Image + info */}
            <div className="space-y-4">
              {item.thumbnailUrl && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
                    <img src={item.thumbnailUrl} alt={item.name} className="h-full w-full object-cover" />
                  </div>
                </div>
              )}
              <h2 className="text-2xl font-semibold text-slate-900">{item.name}</h2>
            </div>

            {/* Price panel */}
            <aside className="self-start space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Unit price</p>
                <p className="mt-1 text-3xl font-semibold text-slate-900">
                  {formatRands(item.unitPriceCents)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Quantity</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{item.quantity}</p>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Subtotal</p>
                <p className="mt-1 text-xl font-semibold text-[#00CED1]">
                  {formatRands(item.lineTotalCents)}
                </p>
              </div>
            </aside>
          </div>
        ))}
      </div>

      {/* Order total row */}
      <div className="flex justify-end rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="text-right">
          <p className="text-xs text-slate-500">Subtotal {formatRands(order.subtotalCents)} · Delivery {formatRands(order.deliveryFeeCents)}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.1em] text-slate-500">Order total</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatRands(order.totalCents)}
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

      {/* Refund status */}
      {refund && (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Refund request</h2>
          <p className="text-sm font-semibold text-slate-700">{REFUND_STATUS_LABEL[refund.status] || refund.status}</p>
          {refund.reason && <p className="text-sm text-slate-600">Your reason: {refund.reason}</p>}
          {refund.adminResponse && <p className="text-sm text-slate-600">Our response: {refund.adminResponse}</p>}
          {refund.eftReference && <p className="text-xs text-slate-500">EFT reference: {refund.eftReference}</p>}
          {formatDate(refund.createdAt) && <p className="text-xs text-slate-500">Requested {formatDate(refund.createdAt)}</p>}
          {Array.isArray(refund.images) && refund.images.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {/* Private URLs: plain <img>, never next/image. */}
              {refund.images.map((image, i) => (
                <img key={image.id} src={image.url} alt={`Refund photo ${i + 1}`} className="h-32 w-full rounded-xl object-cover" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Refund CTA, only when the API says the order can be refunded */}
      {order.canRequestRefund && (
        <div className="flex flex-col items-end gap-2">
          {deadline && <p className="text-xs text-slate-500">You can request a refund until {deadline} (24 hours after delivery).</p>}
          <Link
            href={refundHref}
            className="rounded-full bg-rose-600 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Request refund
          </Link>
        </div>
      )}
    </div>
  );
}
