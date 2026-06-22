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
  markAdminNotificationsRead,
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
          const [pricingError, setPricingError] = useState('');
          const [processingId, setProcessingId] = useState(null);
          const [removingProductId, setRemovingProductId] = useState(null);
          const [isRemovingDemoProducts, setIsRemovingDemoProducts] = useState(false);
          const [pricingProduct, setPricingProduct] = useState(null);
          const [isSavingPricing, setIsSavingPricing] = useState(false);
          const [pricingForm, setPricingForm] = useState({
            basePrice: '',
            specialEnabled: false,
            specialType: 'percent',
            specialValue: '',
            specialLabel: '',
            specialStartAt: '',
            specialEndAt: '',
          });
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
                  fetchLiveProducts({ includeAllStatuses: true }),
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
        const [rejectingSubmission, setRejectingSubmission] = useState(null);
        const [rejectionReason, setRejectionReason] = useState('');
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

  useEffect(() => {
    if (!user || profile?.role !== 'admin') return;

    // Clear sale-notification bubble once admin opens the dashboard.
    markAdminNotificationsRead().catch(() => {
      // Keep dashboard usable even if marking notifications read fails.
    });
  }, [user, profile?.role]);

  const handleOpenRejectModal = (submission) => {
    setError('');
    setRejectingSubmission(submission);
    setRejectionReason('');
  };

  const handleCancelReject = () => {
    setRejectingSubmission(null);
    setRejectionReason('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingSubmission) {
      return;
    }

    const trimmedReason = rejectionReason.trim();
    if (!trimmedReason) {
      setError('Please provide a rejection reason for the seller.');
      return;
    }

    setProcessingId(rejectingSubmission.id);
    setError('');
    try {
      await rejectSubmission(rejectingSubmission.id, user?.uid || 'admin', trimmedReason);
      setSubmissions((prev) => prev.filter((s) => s.id !== rejectingSubmission.id));
      setRejectingSubmission(null);
      setRejectionReason('');
    } catch (err) {
      setError(err?.message || 'Failed to reject submission. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenPricingEditor = (product) => {
    setPricingError('');
    setPricingProduct(product);
    setPricingForm({
      basePrice: String(product.basePrice ?? product.price ?? ''),
      specialEnabled: Boolean(product.specialEnabled),
      specialType: product.specialType || 'percent',
      specialValue: product.specialValue != null ? String(product.specialValue) : '',
      specialLabel: product.specialLabel || '',
      specialStartAt: toDateTimeLocalValue(product.specialStartAt),
      specialEndAt: toDateTimeLocalValue(product.specialEndAt),
    });
  };

  const handleClosePricingEditor = () => {
    setPricingProduct(null);
    setPricingError('');
    setIsSavingPricing(false);
  };

  const handleSavePricing = async () => {
    if (!pricingProduct) {
      return;
    }

    const basePriceNumber = Number(pricingForm.basePrice);
    if (!Number.isFinite(basePriceNumber) || basePriceNumber <= 0) {
      setPricingError('Base price must be greater than 0.');
      return;
    }

    const payload = {
      basePrice: basePriceNumber,
      specialEnabled: pricingForm.specialEnabled,
      specialType: pricingForm.specialType,
      specialValue: pricingForm.specialEnabled ? Number(pricingForm.specialValue || 0) : 0,
      specialLabel: pricingForm.specialLabel.trim(),
      specialStartAt: pricingForm.specialEnabled ? toIsoFromDateTimeLocal(pricingForm.specialStartAt) : '',
      specialEndAt: pricingForm.specialEnabled ? toIsoFromDateTimeLocal(pricingForm.specialEndAt) : '',
    };

    setIsSavingPricing(true);
    setPricingError('');
    try {
      await updateProductPricingAsAdmin(pricingProduct.id, payload, user?.uid || 'admin');
      const refreshedProducts = await fetchLiveProducts({ includeAllStatuses: true });
      setProducts(refreshedProducts || []);
      setPricingProduct(null);
    } catch (err) {
      setPricingError(err?.message || 'Failed to update pricing.');
    } finally {
      setIsSavingPricing(false);
    }
  };
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
                      setError('');
                      try {
                        await approveSubmission(submission.id, user?.uid || 'admin');
                        setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
                      } catch (err) {
                        setError(err?.message || 'Failed to approve submission. Please try again.');
                      } finally {
                        setProcessingId(null);
                      }
                    }}
                    disabled={processingId === submission.id}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {processingId === submission.id ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenRejectModal(submission)}
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
                        {(product.status || '').toLowerCase() === 'listed' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPricingEditor(product)}
                            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
                          >
                            Edit pricing
                          </button>
                        ) : null}
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
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00C5CD]">Submission details</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedSubmission.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedSubmission.category || 'Uncategorized'} · Submitted by {selectedSubmission.sellerEmail || 'Unknown'}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
              >
                Close
              </button>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                {getSubmissionImages(selectedSubmission).length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Images</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {getSubmissionImages(selectedSubmission).map((imageSrc) => (
                        <div key={imageSrc} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                          <img src={imageSrc} alt={selectedSubmission.name} className="h-44 w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Description</h3>
                  <p className="mt-3 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {selectedSubmission.description || 'No description provided.'}
                  </p>
                </div>

                {Array.isArray(selectedSubmission.specifications) && selectedSubmission.specifications.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Specifications</h3>
                    <ul className="mt-3 list-disc space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-700">
                      {selectedSubmission.specifications.map((spec) => (
                        <li key={spec}>{spec}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Submission fields</h3>
                  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {Object.entries(selectedSubmission)
                          .filter(([key, value]) => {
                            if (HIDDEN_SUBMISSION_KEYS.has(key)) return false;
                            if (key === 'description' || key === 'specifications') return false;
                            if (value === null || value === undefined) return false;
                            if (typeof value === 'string' && value.trim() === '') return false;
                            if (Array.isArray(value) && value.length === 0) return false;
                            return true;
                          })
                          .map(([key, value]) => (
                            <tr key={key}>
                              <td className="w-1/3 px-4 py-3 align-top font-medium text-slate-600">{formatFieldLabel(key)}</td>
                              <td className="px-4 py-3 text-slate-900">
                                {Array.isArray(value)
                                  ? value.join(', ')
                                  : typeof value === 'object'
                                    ? JSON.stringify(value)
                                    : String(value)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Record info</h3>
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-2">
                    <p><span className="font-semibold text-slate-900">Status:</span> {selectedSubmission.status || 'pending'}</p>
                    <p><span className="font-semibold text-slate-900">Created:</span> {selectedSubmission.createdAt?.toDate ? selectedSubmission.createdAt.toDate().toLocaleString() : 'Unknown'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* --- Reject Submission Modal --- */}
      {rejectingSubmission ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">Reject submission</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">{rejectingSubmission.name}</h3>
                <p className="mt-1 text-sm text-slate-500">Provide feedback for the seller.</p>
              </div>
              <button
                type="button"
                onClick={handleCancelReject}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
              >
                Close
              </button>
            </div>

            <div className="mt-5">
              <label className="block text-sm font-medium text-slate-700">Rejection reason</label>
              <textarea
                rows={5}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Explain why this submission was rejected and what the seller should change."
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              />
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelReject}
                className="rounded-3xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={processingId === rejectingSubmission.id}
                className="rounded-3xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {processingId === rejectingSubmission.id ? 'Rejecting...' : 'Reject submission'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* --- Pricing Editor Modal --- */}
      {pricingProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00C5CD]">Pricing editor</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">{pricingProduct.name}</h3>
                <p className="mt-1 text-sm text-slate-500">Change base price and promotion settings for this listed product.</p>
              </div>
              <button
                type="button"
                onClick={handleClosePricingEditor}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Base price (R)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricingForm.basePrice}
                  onChange={(event) => setPricingForm((prev) => ({ ...prev, basePrice: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                />
              </label>

              <label className="mt-7 flex items-center gap-3 text-sm font-medium text-slate-700 sm:mt-0 sm:self-end">
                <input
                  type="checkbox"
                  checked={pricingForm.specialEnabled}
                  onChange={(event) => setPricingForm((prev) => ({ ...prev, specialEnabled: event.target.checked }))}
                />
                Enable promotion / discount tag
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Discount type
                <select
                  value={pricingForm.specialType}
                  onChange={(event) => setPricingForm((prev) => ({ ...prev, specialType: event.target.value }))}
                  disabled={!pricingForm.specialEnabled}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm disabled:opacity-60"
                >
                  <option value="percent">Percent off</option>
                  <option value="amount">Amount off (R)</option>
                  <option value="fixed">Fixed promo price (R)</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Discount value
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricingForm.specialValue}
                  onChange={(event) => setPricingForm((prev) => ({ ...prev, specialValue: event.target.value }))}
                  disabled={!pricingForm.specialEnabled}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm disabled:opacity-60"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                Discount tag label
                <input
                  type="text"
                  maxLength={40}
                  value={pricingForm.specialLabel}
                  onChange={(event) => setPricingForm((prev) => ({ ...prev, specialLabel: event.target.value }))}
                  disabled={!pricingForm.specialEnabled}
                  placeholder="Example: Winter Sale"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm disabled:opacity-60"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Promo start
                <input
                  type="datetime-local"
                  value={pricingForm.specialStartAt}
                  onChange={(event) => setPricingForm((prev) => ({ ...prev, specialStartAt: event.target.value }))}
                  disabled={!pricingForm.specialEnabled}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm disabled:opacity-60"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Promo end
                <input
                  type="datetime-local"
                  value={pricingForm.specialEndAt}
                  onChange={(event) => setPricingForm((prev) => ({ ...prev, specialEndAt: event.target.value }))}
                  disabled={!pricingForm.specialEnabled}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm disabled:opacity-60"
                />
              </label>
            </div>

            {pricingError ? <p className="mt-4 text-sm text-red-600">{pricingError}</p> : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handleClosePricingEditor}
                className="rounded-3xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePricing}
                disabled={isSavingPricing}
                className="rounded-3xl bg-[#00CED1] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00C5CD] disabled:opacity-60"
              >
                {isSavingPricing ? 'Saving...' : 'Save pricing'}
              </button>
            </div>
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

