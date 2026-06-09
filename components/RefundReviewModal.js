import React, { useState } from 'react';

export default function RefundReviewModal({ refund, loading, onSubmit, onClose }) {
  const [response, setResponse] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold mb-2">Refund Request</h2>
        <p className="mb-2 text-slate-700"><span className="font-semibold">Order ID:</span> {refund.orderId}</p>
        <p className="mb-2 text-slate-700"><span className="font-semibold">User:</span> {refund.userEmail}</p>
        <p className="mb-2 text-slate-700"><span className="font-semibold">Reason:</span> {refund.reason}</p>
        {refund.imageUrls && refund.imageUrls.length > 0 && (
          <div className="mb-2">
            <span className="font-semibold text-slate-700">Images:</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {refund.imageUrls.map((url, idx) => (
                <img key={idx} src={url} alt={`Refund image ${idx + 1}`} className="rounded-xl border border-slate-200 object-cover w-full h-32" />
              ))}
            </div>
          </div>
        )}
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!response.trim()) return;
            onSubmit(refund.orderId, 'accept', response);
          }}
          className="space-y-4 mt-4"
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Admin Response</span>
            <textarea
              value={response}
              onChange={e => setResponse(e.target.value)}
              required
              rows={3}
              className="w-full rounded border px-3 py-2"
              placeholder="Type your response to the user..."
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 text-white px-4 py-2 rounded font-semibold disabled:opacity-60"
            >
              {loading ? 'Processing...' : 'Accept Refund'}
            </button>
            <button
              type="button"
              disabled={loading}
              className="bg-rose-600 text-white px-4 py-2 rounded font-semibold disabled:opacity-60"
              onClick={() => onSubmit(refund.orderId, 'deny', response)}
            >
              {loading ? 'Processing...' : 'Deny Refund'}
            </button>
            <button
              type="button"
              className="bg-slate-400 text-white px-4 py-2 rounded"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}