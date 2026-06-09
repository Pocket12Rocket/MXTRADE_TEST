import { useState } from 'react';
import { useRouter } from 'next/router';
import useAuth from '../../../../lib/useAuth';
import { submitRefundRequest } from '../../../../lib/firestoreHelpers';

export default function ReturnOrderPage() {
  const router = useRouter();
  const { orderId } = router.query;
  const { user, loading } = useAuth();
  const [reason, setReason] = useState('');
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (loading) return <div className="flex justify-center items-center min-h-[40vh]"><p>Loading...</p></div>;
  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-16 p-8 rounded-3xl border border-slate-200 bg-white shadow-sm text-center">
        <h1 className="text-2xl font-semibold mb-4">Sign in to request a return</h1>
        <p className="mb-6 text-slate-600">Please log in to submit a return request.</p>
      </div>
    );
  }

  const handleImageChange = (e) => {
    setImages(Array.from(e.target.files));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await submitRefundRequest({ orderId, user, reason, images });
      setSuccess(true);
      setTimeout(() => router.push('/profile/orders'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to submit refund request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-16 p-8 rounded-3xl border border-slate-200 bg-white shadow-sm text-center">
        <h1 className="text-2xl font-semibold mb-4">Refund request submitted!</h1>
        <p className="mb-6 text-slate-600">Your refund request has been sent to the admin team. You will be notified by email once reviewed.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-8 p-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
      <h1 className="text-2xl font-semibold mb-6">Submit Refund Request</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Reason for refund</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            required
            rows={3}
            className="w-full rounded border px-3 py-2"
            placeholder="Describe the issue with your order..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Upload images (optional)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            className="block w-full text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="bg-emerald-600 text-white px-6 py-2 rounded font-semibold disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Submit Refund'}
        </button>
      </form>
    </div>
  );
}
