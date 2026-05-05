import Link from 'next/link';
import { useRouter } from 'next/router';

export default function OrderConfirmationPage() {
  const { query } = useRouter();
  const orderId = typeof query.orderId === 'string' ? query.orderId : '';

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-emerald-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Order placed!</h1>
        <p className="mt-2 text-slate-600">
          Your shipping details have been saved. You will be redirected to payment shortly.
        </p>
        {orderId ? (
          <p className="mt-3 text-xs text-slate-400">Order reference: <span className="font-mono">{orderId}</span></p>
        ) : null}
      </div>
      <p className="max-w-sm text-sm text-slate-500">
        PayFast payment integration is coming soon. Your order has been recorded and we will contact you to complete payment.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/shop" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">
          Continue shopping
        </Link>
        <Link href="/" className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400">
          Go to home
        </Link>
      </div>
    </div>
  );
}
