import Link from 'next/link';
import { useEffect, useState } from 'react';
import useAuth from '@/lib/useAuth';
import { listMySubmissions } from '@/lib/api/submissions';
import { toUserMessage } from '@/lib/userMessage';

// Why: one page is enough for the dashboard count; "N+" is shown if the seller has more pending.
const PENDING_COUNT_LIMIT = 100;

/**
 * Why: Seller landing page. Shows how many of the seller's submissions are waiting for review
 * (from `GET /me/submissions?status=pending`). Errors show a friendly sentence via `toUserMessage()`.
 * @returns The seller dashboard, a sign-in prompt, or a seller-onboarding prompt.
 */
export default function SellerDashboard() {
  const { user, profile, loading } = useAuth();
  const [pending, setPending] = useState({ count: 0, hasMore: false });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && user && profile?.canSell) {
      listMySubmissions({ status: 'pending', limit: PENDING_COUNT_LIMIT })
        .then(({ items, nextCursor }) =>
          setPending({ count: items.length, hasMore: Boolean(nextCursor) }),
        )
        .catch((err) =>
          setError(
            toUserMessage(err, "We couldn't load your submissions right now. Please try again."),
          ),
        );
    }
  }, [loading, user, profile?.canSell]);

  if (loading) {
    return <p>Loading seller dashboard...</p>;
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Please sign in to access the seller dashboard.</p>
        <Link
          href="/login"
          className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-white hover:bg-slate-800"
        >
          Log in
        </Link>
      </div>
    );
  }

  if (!profile?.canSell) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">
          Selling is not enabled on your account yet. Complete your profile before you can list
          products.
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-white hover:bg-slate-800"
        >
          Go to profile
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Seller dashboard</h1>
      </div>
      <div className="space-y-4">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-3xl border border-slate-200 bg-white px-6 py-5 text-xl font-semibold text-slate-900 shadow-sm marker:hidden">
            Submit a product
            <span className="text-2xl font-normal text-slate-400 transition-transform group-open:rotate-180">
              ⌄
            </span>
          </summary>
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-slate-600">
              Products are submitted as drafts and reviewed by admin before they go live.
            </p>
            <Link
              href="/seller/submit"
              className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Submit new item
            </Link>
          </div>
        </details>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-3xl border border-slate-200 bg-white px-6 py-5 text-xl font-semibold text-slate-900 shadow-sm marker:hidden">
            Submissions
            <span className="text-2xl font-normal text-slate-400 transition-transform group-open:rotate-180">
              ⌄
            </span>
          </summary>
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-slate-600">
              You currently have {pending.count}
              {pending.hasMore ? '+' : ''} submission
              {pending.count === 1 && !pending.hasMore ? '' : 's'} in your queue.
            </p>
            <Link
              href="/seller/submissions"
              className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              View submissions
            </Link>
          </div>
        </details>
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-3xl border border-slate-200 bg-white px-6 py-5 text-xl font-semibold text-slate-900 shadow-sm marker:hidden">
            Seller profile
            <span className="text-2xl font-normal text-slate-400 transition-transform group-open:rotate-180">
              ⌄
            </span>
          </summary>
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-slate-600">Role: {profile?.role}</p>
            <p className="mt-1 text-slate-600">Email: {profile?.email}</p>
          </div>
        </details>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
    </div>
  );
}
