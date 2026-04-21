import Link from 'next/link';
import { useEffect, useState } from 'react';
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
} from '../../lib/firestoreHelpers';

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

export default function AdminDashboard() {
  const { user, profile, loading } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState('');
  const [removingProductId, setRemovingProductId] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [selectedSellerProfile, setSelectedSellerProfile] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [sellerTrustScore, setSellerTrustScore] = useState(null);
  const [sellerBadge, setSellerBadge] = useState('');
  const [trustScoreLoading, setTrustScoreLoading] = useState(false);
  const [selectedPricingProduct, setSelectedPricingProduct] = useState(null);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [isRemovingDemoProducts, setIsRemovingDemoProducts] = useState(false);
  const [pricingForm, setPricingForm] = useState({
    basePrice: '',
    specialEnabled: false,
    specialType: 'percent',
    specialValue: '',
    specialLabel: '',
    specialStartAt: '',
    specialEndAt: '',
  });
  const [sellers, setSellers] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [sellerScoreLoading, setSellerScoreLoading] = useState(false);
  const [sellerScore, setSellerScore] = useState(null);
  const [sellerScoreBadge, setSellerScoreBadge] = useState('');

  useEffect(() => {
    if (!loading && profile?.role === 'admin') {
      fetchPendingSubmissions()
        .then(setSubmissions)
        .catch((err) => setError(err.message));

      fetchLiveProducts()
        .then((items) => {
          const userListedProducts = items.filter((item) => item.sellerId && item.sellerId !== 'demo-seed');
          setProducts(userListedProducts);
        })
        .catch((err) => setError(err.message));

      fetchAllSellers()
        .then(setSellers)
        .catch(() => {});
    }
  }, [loading, profile]);

  const handleSelectSeller = async (seller) => {
    setSelectedSeller(seller);
    setSellerScoreLoading(true);
    try {
      const privateProfile = await fetchSellerPrivateProfile(seller.id);
      setSellerScore(privateProfile?.sellerTrustScore ?? 0);
      setSellerScoreBadge(privateProfile?.sellerBadge || '');
    } catch {
      setSellerScore(null);
      setSellerScoreBadge('');
    }
    setSellerScoreLoading(false);
  };

  const handleAdjustSellerScore = async (delta) => {
    if (!selectedSeller?.id) return;
    setSellerScoreLoading(true);
    try {
      const result = await updateSellerTrustScore(selectedSeller.id, delta);
      setSellerScore(result.sellerTrustScore);
      setSellerScoreBadge(result.sellerBadge);
    } catch {}
    setSellerScoreLoading(false);
  };

  const handleApprove = async (submissionId) => {
    if (!user) return;
    setProcessingId(submissionId);
    setError('');

    try {
      await approveSubmission(submissionId, user.uid);
      setSubmissions((prev) => prev.filter((item) => item.id !== submissionId));
      if (selectedSubmission?.id === submissionId) {
        handleCloseDetails();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId('');
    }
  };

  const handleReject = async (submissionId) => {
    if (!user) return;

    const feedbackInput = window.prompt('Provide admin feedback for this rejection:', 'Not approved by admin at this time.');
    if (feedbackInput === null) {
      return;
    }

    const rejectionReason = feedbackInput.trim() || 'Not approved by admin at this time.';

    setProcessingId(submissionId);
    setError('');

    try {
      await rejectSubmission(submissionId, user.uid, rejectionReason);
      setSubmissions((prev) => prev.filter((item) => item.id !== submissionId));
      if (selectedSubmission?.id === submissionId) {
        handleCloseDetails();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId('');
    }
  };

  const handleRemoveProduct = async (productId) => {
    if (!user) return;

    const shouldRemove = window.confirm('Remove this product from the live catalog?');
    if (!shouldRemove) {
      return;
    }

    setRemovingProductId(productId);
    setError('');

    try {
      await removeProductAsAdmin(productId);
      setProducts((prev) => prev.filter((item) => item.id !== productId));
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingProductId('');
    }
  };

  const handleOpenPricingEditor = (product) => {
    setSelectedPricingProduct(product);
    setPricingForm({
      basePrice: String(Number(product.basePrice ?? product.price ?? 0) || 0),
      specialEnabled: Boolean(product.specialEnabled),
      specialType: product.specialType || 'percent',
      specialValue: String(Number(product.specialValue || 0) || 0),
      specialLabel: product.specialLabel || '',
      specialStartAt: toDateTimeLocalValue(product.specialStartAt),
      specialEndAt: toDateTimeLocalValue(product.specialEndAt),
    });
  };

  const handleClosePricingEditor = () => {
    setSelectedPricingProduct(null);
    setPricingSaving(false);
  };

  const handleSavePricing = async (event) => {
    event.preventDefault();

    if (!selectedPricingProduct || !user) {
      return;
    }

    setPricingSaving(true);
    setError('');

    try {
      await updateProductPricingAsAdmin(
        selectedPricingProduct.id,
        {
          basePrice: Number(pricingForm.basePrice),
          specialEnabled: pricingForm.specialEnabled,
          specialType: pricingForm.specialType,
          specialValue: Number(pricingForm.specialValue || 0),
          specialLabel: pricingForm.specialLabel,
          specialStartAt: toIsoFromDateTimeLocal(pricingForm.specialStartAt),
          specialEndAt: toIsoFromDateTimeLocal(pricingForm.specialEndAt),
        },
        user.uid
      );

      const latestProducts = await fetchLiveProducts();
      const userListedProducts = latestProducts.filter((item) => item.sellerId && item.sellerId !== 'demo-seed');
      setProducts(userListedProducts);
      handleClosePricingEditor();
    } catch (err) {
      setError(err.message || 'Failed to update pricing.');
    } finally {
      setPricingSaving(false);
    }
  };

  const handleRemoveDemoProducts = async () => {
    if (!user) {
      return;
    }

    const shouldRemove = window.confirm('This will permanently delete all seeded demo products. Continue?');
    if (!shouldRemove) {
      return;
    }

    setIsRemovingDemoProducts(true);
    setError('');

    try {
      const removedCount = await removeDemoProducts();
      const latestProducts = await fetchLiveProducts();
      const userListedProducts = latestProducts.filter((item) => item.sellerId && item.sellerId !== 'demo-seed');
      setProducts(userListedProducts);

      if (removedCount === 0) {
        setError('No demo products were found to remove.');
      }
    } catch (err) {
      setError(err.message || 'Failed to remove demo products.');
    } finally {
      setIsRemovingDemoProducts(false);
    }
  };

  const handleOpenDetails = async (submission) => {
    setSelectedSubmission(submission);
    setSelectedSellerProfile(null);
    setLoadingDetails(true);
    setSellerTrustScore(null);
    setSellerBadge('');
    try {
      const sellerProfile = await fetchUserProfileById(submission.sellerId);
      setSelectedSellerProfile(sellerProfile);
      // Fetch trust score and badge from private profile
      const privateProfile = await fetchSellerPrivateProfile(submission.sellerId);
      setSellerTrustScore(privateProfile?.sellerTrustScore ?? 0);
      setSellerBadge(privateProfile?.sellerBadge || '');
    } catch {
      setSelectedSellerProfile(null);
      setSellerTrustScore(null);
      setSellerBadge('');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAdjustTrustScore = async (delta) => {
    if (!selectedSubmission?.sellerId) return;
    setTrustScoreLoading(true);
    try {
      const result = await updateSellerTrustScore(selectedSubmission.sellerId, delta);
      setSellerTrustScore(result.sellerTrustScore);
      setSellerBadge(result.sellerBadge);
    } catch {}
    setTrustScoreLoading(false);
  };

  const handleCloseDetails = () => {
    setSelectedSubmission(null);
    setSelectedSellerProfile(null);
    setLoadingDetails(false);
  };

  const detailEntries = selectedSubmission
    ? Object.entries(selectedSubmission).filter(([key, value]) => {
        if (HIDDEN_SUBMISSION_KEYS.has(key)) {
          return false;
        }

        if (value === null || value === undefined) {
          return false;
        }

        if (typeof value === 'string' && value.trim() === '') {
          return false;
        }

        if (Array.isArray(value) && value.length === 0) {
          return false;
        }

        return true;
      })
    : [];

  const detailImages = getSubmissionImages(selectedSubmission);

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
            onClick={handleRemoveDemoProducts}
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
                    onClick={() => handleOpenDetails(submission)}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
                  >
                    View details
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(submission.id)}
                    disabled={processingId === submission.id}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(submission.id)}
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

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Sellers (manual trust scoring)</h2>
          <p className="mt-1 text-sm text-slate-600">View and adjust trust score for any seller.</p>
        </div>
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm mb-8">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sellers.map((seller) => (
                <tr key={seller.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{getSellerName(seller, seller.email)}</td>
                  <td className="px-4 py-3 text-slate-600">{seller.email}</td>
                  <td className="px-4 py-3 text-slate-600">{seller.role}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSelectSeller(seller)}
                      className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
                    >
                      View / Adjust Score
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selectedSeller && (
          <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Seller: {getSellerName(selectedSeller, selectedSeller.email)}</h3>
            <p className="text-sm text-slate-600 mb-2">Email: {selectedSeller.email}</p>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-semibold text-slate-700">Trust score:</span>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-900">{sellerScoreLoading ? '...' : sellerScore ?? 'N/A'}</span>
              {sellerScoreBadge === 'gold' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/80 px-2 py-0.5 text-xs font-bold text-yellow-900">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="9" /></svg>
                  Gold
                </span>
              )}
              {sellerScoreBadge === 'platinum' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-300/80 px-2 py-0.5 text-xs font-bold text-gray-900">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="9" /></svg>
                  Platinum
                </span>
              )}
              <button
                type="button"
                className="ml-2 rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                disabled={sellerScoreLoading}
                onClick={() => handleAdjustSellerScore(1)}
              >
                +1
              </button>
              <button
                type="button"
                className="rounded-full bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                disabled={sellerScoreLoading}
                onClick={() => handleAdjustSellerScore(-1)}
              >
                -1
              </button>
            </div>
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Live user-listed products</h2>
          <p className="mt-1 text-sm text-slate-600">Simple list view for product moderation.</p>
        </div>

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
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenPricingEditor(product)}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
                        >
                          Edit pricing
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(product.id)}
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
      </section>

      {selectedPricingProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00C5CD]">Pricing editor</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedPricingProduct.name}</h2>
              </div>
              <button
                type="button"
                onClick={handleClosePricingEditor}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSavePricing} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Base price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricingForm.basePrice}
                  onChange={(event) => setPricingForm((currentValue) => ({ ...currentValue, basePrice: event.target.value }))}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={pricingForm.specialEnabled}
                  onChange={(event) => setPricingForm((currentValue) => ({ ...currentValue, specialEnabled: event.target.checked }))}
                />
                Enable special pricing
              </label>

              {pricingForm.specialEnabled ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="text-sm font-medium text-slate-700">Special label</span>
                    <input
                      type="text"
                      value={pricingForm.specialLabel}
                      onChange={(event) => setPricingForm((currentValue) => ({ ...currentValue, specialLabel: event.target.value }))}
                      placeholder="Weekend Deal"
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Special type</span>
                    <select
                      value={pricingForm.specialType}
                      onChange={(event) => setPricingForm((currentValue) => ({ ...currentValue, specialType: event.target.value }))}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <option value="percent">Percentage off</option>
                      <option value="amount">Amount off</option>
                      <option value="fixed">Fixed special price</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Value</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricingForm.specialValue}
                      onChange={(event) => setPricingForm((currentValue) => ({ ...currentValue, specialValue: event.target.value }))}
                      required
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Start date (optional)</span>
                    <input
                      type="datetime-local"
                      value={pricingForm.specialStartAt}
                      onChange={(event) => setPricingForm((currentValue) => ({ ...currentValue, specialStartAt: event.target.value }))}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">End date (optional)</span>
                    <input
                      type="datetime-local"
                      value={pricingForm.specialEndAt}
                      onChange={(event) => setPricingForm((currentValue) => ({ ...currentValue, specialEndAt: event.target.value }))}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                    />
                  </label>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={pricingSaving}
                  className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {pricingSaving ? 'Saving...' : 'Save pricing'}
                </button>
                <button
                  type="button"
                  onClick={handleClosePricingEditor}
                  className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedSubmission ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00C5CD]">Submission details</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selectedSubmission.name}</h2>
              </div>
              <button
                type="button"
                onClick={handleCloseDetails}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
              >
                Close
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Submitted by</p>
              {loadingDetails ? (
                <p className="mt-2 text-sm text-slate-600">Loading seller details...</p>
              ) : selectedSellerProfile ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Name:</span> {getSellerName(selectedSellerProfile, selectedSubmission.sellerEmail)}
                  </p>
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Email:</span> {selectedSellerProfile.email || selectedSubmission.sellerEmail || 'Unknown'}
                  </p>
                  {selectedSellerProfile.phone && (
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Phone:</span> {selectedSellerProfile.phone}
                    </p>
                  )}
                  {selectedSellerProfile.streetAddress && (
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Address:</span> {selectedSellerProfile.streetAddress}
                    </p>
                  )}
                  {selectedSellerProfile.suburb && (
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Suburb:</span> {selectedSellerProfile.suburb}
                    </p>
                  )}
                  {selectedSellerProfile.city && (
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">City:</span> {selectedSellerProfile.city}
                    </p>
                  )}
                  {selectedSellerProfile.postCode && (
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Post Code:</span> {selectedSellerProfile.postCode}
                    </p>
                  )}
                  {/* Exclude bankName, branchName, branchCode, accountNumber */}
                  <div className="col-span-2 mt-2 flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-700">Trust score:</span>
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-900">{sellerTrustScore ?? 'N/A'}</span>
                    {sellerBadge === 'gold' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/80 px-2 py-0.5 text-xs font-bold text-yellow-900">
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="9" /></svg>
                        Gold
                      </span>
                    )}
                    {sellerBadge === 'platinum' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-300/80 px-2 py-0.5 text-xs font-bold text-gray-900">
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="9" /></svg>
                        Platinum
                      </span>
                    )}
                    <button
                      type="button"
                      className="ml-2 rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      disabled={trustScoreLoading}
                      onClick={() => handleAdjustTrustScore(1)}
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                      disabled={trustScoreLoading}
                      onClick={() => handleAdjustTrustScore(-1)}
                    >
                      -1
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-slate-900">Submitted fields</h3>
              {detailEntries.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">No field data available.</p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Field</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {detailEntries.map(([key, value]) => (
                        <tr key={key}>
                          <td className="px-4 py-3 align-top text-slate-700">{formatFieldLabel(key)}</td>
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
              )}
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-slate-900">Images supplied</h3>
              {detailImages.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">No images supplied.</p>
              ) : (
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {detailImages.map((imageSrc) => (
                    <div key={imageSrc} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      <img src={imageSrc} alt={selectedSubmission.name} className="h-48 w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleApprove(selectedSubmission.id)}
                disabled={processingId === selectedSubmission.id}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {processingId === selectedSubmission.id ? 'Processing...' : 'Approve'}
              </button>
              <button
                type="button"
                onClick={() => handleReject(selectedSubmission.id)}
                disabled={processingId === selectedSubmission.id}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {processingId === selectedSubmission.id ? 'Processing...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
