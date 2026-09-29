import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import useAuth from '../lib/useAuth';
import { REFUND_MAX_IMAGES, REFUND_MIN_IMAGES, getOrderToken, requestRefund } from '../lib/api/orders';
import { toUserMessage } from '../lib/userMessage';

/**
 * Why: Refund request form (`POST /orders/{id}/refund-request`) shared by the signed-in and guest
 * return pages. Photos are required (1-5, D-08) and sent uncropped as chosen; the backend's 409
 * `REFUND_WINDOW_CLOSED` / `ORDER_NOT_REFUNDABLE` messages are shown through `toUserMessage()`.
 * Guests are authorised by their stored order token, which is sent with the request. No bank
 * details are collected (open decision D-22).
 * @param {object} props - Component props.
 * @param {string} props.orderId - Order UUID.
 * @param {string} props.signedInDoneHref - Where a signed-in buyer goes after success.
 * @param {string} props.guestDoneHref - Where a token-only guest goes after success.
 * @returns {JSX.Element} The refund form, a sign-in prompt, or the success message.
 * @example
 * <RefundRequestForm orderId={orderId} signedInDoneHref="/profile/orders" guestDoneHref={`/order/${orderId}`} />
 */
export default function RefundRequestForm({ orderId, signedInDoneHref, guestDoneHref }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [reason, setReason] = useState('');
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleImageChange = (e) => {
    const incomingFiles = Array.from(e.target.files || []);

    setImages((prev) => {
      const seen = new Set((prev || []).map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const merged = [...(prev || [])];

      incomingFiles.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(file);
        }
      });

      return merged;
    });

    // Allow selecting the same file again in a later pick.
    e.target.value = '';
  };

  const imagePreviews = useMemo(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    return images.map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
    }));
  }, [images]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [imagePreviews]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (images.length < REFUND_MIN_IMAGES) {
      setError('Please add at least one photo of the problem.');
      return;
    }
    if (images.length > REFUND_MAX_IMAGES) {
      setError(`You can upload up to ${REFUND_MAX_IMAGES} photos. Please remove some.`);
      return;
    }
    setSubmitting(true);
    try {
      await requestRefund(orderId, { reason: reason.trim(), files: images }, getOrderToken(orderId));
      setSuccess(true);
      setTimeout(() => router.push(user ? signedInDoneHref : guestDoneHref), 2000);
    } catch (err) {
      setError(toUserMessage(err, "We couldn't submit your refund request. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center min-h-[40vh]"><p>Loading...</p></div>;
  if (!user && !getOrderToken(orderId)) {
    return (
      <div className="max-w-md mx-auto mt-16 p-8 rounded-3xl border border-slate-200 bg-white shadow-sm text-center">
        <h1 className="text-2xl font-semibold mb-4">Sign in to request a return</h1>
        <p className="mb-6 text-slate-600">Please log in to submit a return request.</p>
      </div>
    );
  }

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
          <label className="block text-sm font-medium text-slate-700 mb-1">Upload images (required, 1 to 5)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            className="block w-full text-sm"
          />

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">Selected images</p>
              <p className="text-xs text-slate-600">{imagePreviews.length} selected</p>
            </div>

            {imagePreviews.length > 0 ? (
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {imagePreviews.map((item, index) => (
                  <div key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <img src={item.previewUrl} alt={item.name} className="h-28 w-full object-cover" />
                    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-3 py-2">
                      <p className="truncate text-xs text-slate-600" title={item.name}>{item.name}</p>
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}
                        className="text-xs font-semibold uppercase tracking-[0.06em] text-rose-700 hover:text-rose-800"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No images selected yet. At least one photo is required.</p>
            )}
          </div>
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
