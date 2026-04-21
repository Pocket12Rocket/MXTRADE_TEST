import Link from 'next/link';
import { useEffect, useState } from 'react';
import useAuth from '../../lib/useAuth';
import { fetchSellerSubmissions } from '../../lib/firestoreHelpers';

export default function SellerDashboard() {
  const { user, profile, loading } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && user) {
      fetchSellerSubmissions(user.uid)
        .then(setSubmissions)
        .catch((err) => setError(err.message));
    }
  }, [loading, user]);

  if (loading) {
    return <p>Loading seller dashboard...</p>;
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Please sign in to access the seller dashboard.</p>
        <Link href="/login" className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-white hover:bg-slate-800">
          Log in
        </Link>
      </div>
    );
  }

  if (!profile?.canSell && profile?.role !== 'admin') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Selling is not enabled on your account yet. Complete your profile before you can list products.</p>
        <Link href="/profile" className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-white hover:bg-slate-800">
          Go to profile
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Seller</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Seller dashboard</h1>
        <p className="mt-4 max-w-2xl text-slate-600">Approved sellers can submit items for review, track pending approvals, and manage submissions.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Submit a product</h2>
          <p className="mt-3 text-slate-600">Products are submitted as drafts and reviewed by admin before they go live.</p>
          <Link href="/seller/submit" className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            Submit new item
          </Link>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Submissions</h2>
          <p className="mt-3 text-slate-600">You currently have {submissions.length} submission{submissions.length === 1 ? '' : 's'} in your queue.</p>
          <Link href="/seller/submissions" className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            View submissions
          </Link>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Seller profile</h2>
          <p className="mt-3 text-slate-600">Role: {profile?.role}</p>
          <p className="mt-1 text-slate-600">Email: {profile?.email}</p>
        </div>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
    </div>
  );
}
