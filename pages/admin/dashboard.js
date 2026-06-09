import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import useAuth from '../../lib/useAuth';
import {
  fetchPendingSubmissions,
  approveSubmission,
  rejectSubmission,
  fetchLiveProducts,
  removeProductAsAdmin,
  fetchUserProfileById,
  updateProductPricingAsAdmin,
  removeDemoProducts,
  fetchSellerPrivateProfile,
  updateSellerTrustScore,
  fetchAllSellers,
  updateProductStatusAsAdmin,
  fetchFaqs,
  addFaq,
  updateFaq,
  deleteFaq,
  fetchRefundPendingOrders,
  fetchRefundRequestForOrder,
  processRefundRequest,
} from '../../lib/firestoreHelpers';



function AdminDashboard() {
          // State for products, submissions, faqs
          const [products, setProducts] = useState([]);
          const [submissions, setSubmissions] = useState([]);
          const [faqs, setFaqs] = useState([]);
          const [faqForm, setFaqForm] = useState({ question: '', answer: '' });
          const [faqEditId, setFaqEditId] = useState(null);
          const [faqError, setFaqError] = useState('');
          const [faqLoading, setFaqLoading] = useState(true);
          const [error, setError] = useState('');
          const [processingId, setProcessingId] = useState(null);
          const [removingProductId, setRemovingProductId] = useState(null);
          const [isRemovingDemoProducts, setIsRemovingDemoProducts] = useState(false);
          // Seller details modal state
          const [selectedSellerProfile, setSelectedSellerProfile] = useState(null);
          const [loadingDetails, setLoadingDetails] = useState(false);
          const [sellerTrustScore, setSellerTrustScore] = useState(null);
          const [sellerBadge, setSellerBadge] = useState(null);
          const [trustScoreLoading, setTrustScoreLoading] = useState(false);

          // Fetch all dashboard data on mount
          useEffect(() => {
            let isMounted = true;
            async function fetchData() {
              try {
                const [subs, prods, faqList] = await Promise.all([
                  fetchPendingSubmissions(),
                  fetchLiveProducts(),
                  fetchFaqs(),
                ]);
                if (isMounted) {
                  setSubmissions(subs || []);
                  setProducts(prods || []);
                  setFaqs(faqList || []);
                  setFaqLoading(false);
                  setLoading(false);
                }
              } catch (err) {
                if (isMounted) {
                  setError('Failed to load dashboard data.');
                  setLoading(false);
                }
              }
            }
            fetchData();
            return () => { isMounted = false; };
          }, []);
        // Submission details modal state
        const [selectedSubmission, setSelectedSubmission] = useState(null);
      // Auth state
      const { user, profile } = useAuth();
    // Unblock loading after mount (replace with real data loading logic as needed)
    useEffect(() => {
      setLoading(false);
    }, []);
  // --- All state, handlers, and main return block go here ---

  // Loading state for dashboard
  const [loading, setLoading] = useState(true);

  // Refunds state
  const [refundOrders, setRefundOrders] = useState([]);
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [refundLoading, setRefundLoading] = useState(true);
  const [refundError, setRefundError] = useState('');
  const [refundActionLoading, setRefundActionLoading] = useState(false);
  // ...other state and handlers...

  // --- Main return block ---
  if (loading) {
    return <p>Loading admin dashboard...</p>;
  }

  if (!user || profile?.role !== 'admin') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Please sign in with an admin account to access this dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* --- Top section: admin info, submissions, sellers, products --- */}
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Admin</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Admin dashboard</h1>
        <p className="mt-4 max-w-2xl text-slate-600">Admins review submitted products and publish approved items to the live catalog.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/admin/seed" className="inline-flex rounded-full bg-[#00CED1] px-5 py-2 text-sm font-semibold text-white hover:bg-[#00C5CD]">
            Seed demo products
          </Link>
          <button
            type="button"
            onClick={async () => {
              setIsRemovingDemoProducts(true);
              await removeDemoProducts();
              setIsRemovingDemoProducts(false);
            }}
            disabled={isRemovingDemoProducts}
            className="inline-flex rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {isRemovingDemoProducts ? 'Removing demo products...' : 'Remove demo products'}
          </button>
        </div>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
      {submissions.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-slate-600">No pending submissions found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <div key={submission.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm text-slate-500">{submission.category}</p>
                  <h2 className="text-xl font-semibold text-slate-900">{submission.name}</h2>
                  <p className="mt-2 text-slate-600">{submission.description}</p>
                  <p className="mt-2 text-sm text-slate-500">Submitted by {submission.sellerEmail}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedSubmission(submission)}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
                  >
                    View details
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setProcessingId(submission.id);
                      await approveSubmission(submission.id);
                      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
                      setProcessingId(null);
                    }}
                    disabled={processingId === submission.id}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setProcessingId(submission.id);
                      await rejectSubmission(submission.id);
                      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
                      setProcessingId(null);
                    }}
                    disabled={processingId === submission.id}
                    className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- Refund Requests Section --- */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Refund Requests</h2>
          <p className="mt-1 text-sm text-slate-600">Review and process pending refund requests from users.</p>
        </div>
        {refundLoading ? (
          <p>Loading refund requests...</p>
        ) : refundOrders.length === 0 ? (
          <p className="text-slate-600">No refund requests pending.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {refundOrders.map((order) => (
              <li key={order.id} className="py-4 flex flex-col md:flex-row md:items-center md:gap-6">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">Order ID: {order.id}</p>
                  <p className="text-slate-600 text-sm">User: {order.buyerEmail}</p>
                  <p className="text-slate-500 text-xs">Status: <span className="font-semibold">{order.status}</span></p>
                </div>
                <div className="mt-2 md:mt-0 flex gap-2">
                  <button
                    className="rounded-full bg-amber-500 text-white px-4 py-2 text-sm font-semibold hover:bg-amber-600"
                    onClick={() => setSelectedRefund(order)}
                  >
                    Review
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {selectedRefund && (
          <RefundReviewModal
            refund={selectedRefund}
            loading={refundActionLoading}
            onSubmit={handleProcessRefund}
            onClose={() => setSelectedRefund(null)}
          />
        )}
      </section>

      {/* --- Live Products Section --- */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Live user-listed products</h2>
        <p className="mt-1 text-sm text-slate-600">Simple list view for product moderation.</p>
        {products.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-slate-600">No live user-listed products found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Product name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">User email</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Price</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">{product.name}</td>
                    <td className="px-4 py-3 text-slate-600">{product.sellerEmail || 'Unknown'}</td>
                    <td className="px-4 py-3 text-slate-900">
                      <div className="space-y-1">
                        <p className="font-semibold">R{Number(product.price || 0).toFixed(2)}</p>
                        {product.isSpecialActive ? (
                          <p className="text-xs text-slate-500">
                            <span className="line-through">R{Number(product.basePrice || 0).toFixed(2)}</span>
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                              {product.specialLabel || 'Special'}
                            </span>
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ProductStatusDropdown product={product} onStatusChange={async (product, newStatus) => {
                        try {
                          await updateProductStatusAsAdmin(product.id, newStatus);
                          setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, status: newStatus } : p));
                        } catch (err) {
                          setError('Failed to update product status.');
                        }
                      }} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {/* Pricing editor logic here */}}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
                        >
                          Edit pricing
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setRemovingProductId(product.id);
                            await removeProductAsAdmin(product.id);
                            setProducts((prev) => prev.filter((p) => p.id !== product.id));
                            setRemovingProductId(null);
                          }}
                          disabled={removingProductId === product.id}
                          className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-white hover:bg-rose-700 disabled:opacity-60"
                        >
                          {removingProductId === product.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- Submission Details Modal --- */}
      {selectedSubmission ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          {/* You can restore the full modal UI here as needed */}
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00C5CD]">Submission details</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedSubmission.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
              >
                Close
              </button>
            </div>
            {/* Add more submission details here as needed */}
          </div>
        </div>
      ) : null}

      {/* --- FAQ Management Section --- */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900">FAQs</h2>
        <p className="mt-1 text-sm text-slate-600">Manage Frequently Asked Questions displayed on the public FAQ page.</p>
        {faqError && <p className="text-red-600 text-sm mb-2">{faqError}</p>}
        <form onSubmit={async (e) => {
          e.preventDefault();
          setFaqError('');
          try {
            if (faqEditId) {
              await updateFaq(faqEditId, faqForm);
              setFaqs((prev) => prev.map((f) => f.id === faqEditId ? { ...f, ...faqForm } : f));
            } else {
              const id = await addFaq(faqForm);
              setFaqs((prev) => [...prev, { id, ...faqForm }]);
            }
            setFaqForm({ question: '', answer: '' });
            setFaqEditId(null);
          } catch (err) {
            setFaqError(err.message);
          }
        }} className="mb-4 flex flex-col gap-2 max-w-xl">
          <input
            type="text"
            name="question"
            value={faqForm.question}
            onChange={e => setFaqForm(f => ({ ...f, question: e.target.value }))}
            placeholder="Question"
            className="rounded border px-3 py-2"
            required
          />
          <textarea
            name="answer"
            value={faqForm.answer}
            onChange={e => setFaqForm(f => ({ ...f, answer: e.target.value }))}
            placeholder="Answer"
            className="rounded border px-3 py-2"
            required
            rows={3}
          />
          <div className="flex gap-2">
            <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded">
              {faqEditId ? 'Update FAQ' : 'Add FAQ'}
            </button>
            {faqEditId && (
              <button type="button" className="bg-slate-400 text-white px-4 py-2 rounded" onClick={() => { setFaqEditId(null); setFaqForm({ question: '', answer: '' }); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
        {faqLoading ? (
          <p>Loading FAQs...</p>
        ) : faqs.length === 0 ? (
          <p className="text-slate-600">No FAQs found.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {faqs.map((faq) => (
              <li key={faq.id} className="py-2 flex flex-col md:flex-row md:items-center md:gap-4">
                <div className="flex-1">
                  <p className="font-semibold">Q: {faq.question}</p>
                  <p className="text-slate-700">A: {faq.answer}</p>
                </div>
                <div className="flex gap-2 mt-2 md:mt-0">
                  <button className="bg-amber-500 text-white px-3 py-1 rounded" onClick={() => { setFaqEditId(faq.id); setFaqForm({ question: faq.question, answer: faq.answer }); }}>Edit</button>
                  <button className="bg-rose-600 text-white px-3 py-1 rounded" onClick={async () => {
                    await deleteFaq(faq.id);
                    setFaqs((prev) => prev.filter((f) => f.id !== faq.id));
                    if (faqEditId === faq.id) {
                      setFaqEditId(null);
                      setFaqForm({ question: '', answer: '' });
                    }
                  }}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// --- Helper: Product status dropdown for admin ---
function ProductStatusDropdown({ product, onStatusChange }) {
  const statusOptions = [
    { value: 'listed', label: 'Listed (public)' },
    { value: 'purchased', label: 'Purchased' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'refunded', label: 'Refunded' },
  ];
  return (
    <select
      className="rounded-3xl border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
      value={product.status || 'listed'}
      onChange={e => onStatusChange(product, e.target.value)}
    >
      {statusOptions.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

export default AdminDashboard;

const HIDDEN_SUBMISSION_KEYS = new Set([
  'id',
  'sellerId',
  'sellerEmail',
  'status',
  'createdAt',
  'primaryImage',
  'images',
  'approvedAt',
  'approvedBy',
  'rejectedAt',
  'rejectedBy',
  'productId',
]);

function formatFieldLabel(fieldName) {
  return fieldName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function getSubmissionImages(submission) {
  if (!submission) {
    return [];
  }

  const imageList = [];

  if (typeof submission.primaryImage === 'string' && submission.primaryImage.trim()) {
    imageList.push(submission.primaryImage.trim());
  }

  if (Array.isArray(submission.images)) {
    submission.images.forEach((item) => {
      if (typeof item === 'string' && item.trim()) {
        imageList.push(item.trim());
      }
    });
  }

  return Array.from(new Set(imageList));
}

function getSellerName(sellerProfile, fallbackEmail) {
  if (!sellerProfile) {
    return fallbackEmail || 'Unknown';
  }

  if (sellerProfile.displayName) {
    return sellerProfile.displayName;
  }

  const fullName = `${sellerProfile.firstName || ''} ${sellerProfile.lastName || ''}`.trim();
  return fullName || sellerProfile.email || fallbackEmail || 'Unknown';
}

function toDateTimeLocalValue(value) {
  if (!value) {
    return '';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  const timezoneOffsetMs = parsedDate.getTimezoneOffset() * 60 * 1000;
  return new Date(parsedDate.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function toIsoFromDateTimeLocal(value) {
  if (!value) {
    return '';
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toISOString();
}

// END OF COMPONENT LOGIC

