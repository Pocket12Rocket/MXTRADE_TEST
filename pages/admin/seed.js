import { useState } from 'react';
import Link from 'next/link';
import useAuth from '../../lib/useAuth';
import { seedDemoProducts } from '../../lib/firestoreHelpers';

export default function AdminSeedPage() {
  const { user, profile, loading } = useAuth();
  const [status, setStatus] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeed = async () => {
    setIsSeeding(true);
    setStatus('');

    try {
      const inserted = await seedDemoProducts(user);
      setStatus(`Inserted ${inserted} demo products successfully.`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSeeding(false);
    }
  };

  if (loading) {
    return <p>Loading admin tools...</p>;
  }

  if (!user || profile?.role !== 'admin') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Only admin users can access this tool.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Admin Tools</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Seed demo products</h1>
        <p className="mt-3 text-slate-600">Use this once to populate test inventory for Gear and Parts pages.</p>
      </div>

      <button
        type="button"
        onClick={handleSeed}
        disabled={isSeeding}
        className="rounded-full bg-[#00CED1] px-6 py-3 text-sm font-semibold text-white hover:bg-[#00C5CD] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSeeding ? 'Seeding...' : 'Insert Demo Products'}
      </button>

      {status ? <p className="text-slate-700">{status}</p> : null}

      <Link href="/admin/dashboard" className="inline-flex text-sm font-medium text-[#00C5CD] hover:text-[#00CED1]">
        Return to admin dashboard →
      </Link>
    </div>
  );
}
