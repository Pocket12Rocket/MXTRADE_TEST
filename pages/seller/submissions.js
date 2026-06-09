import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import useAuth from '../../lib/useAuth';
import {
  fetchSellerSubmissions,
  fetchSellerLiveProducts,
  removeSellerSubmission,
  removeSellerProduct,
  fetchGearBrandOptions,
  updateSellerSubmission,
  updateSellerSubmissionImages,
} from '../../lib/firestoreHelpers';
import { DIRT_BIKE_CATEGORIES, GEAR_BRAND_OPTIONS, GEAR_CONDITION_OPTIONS, GEAR_ITEM_OPTIONS } from '../../lib/dirtBikeCategories';

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

const ALPHA_SIZE_GEAR_ITEMS = ['Helmet', 'Jersey', 'Socks', 'Protection'];
const ALPHA_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', 'Youth S', 'Youth M', 'Youth L', 'Youth XL'];
const PANTS_SIZE_OPTIONS = ['4', '6', '8', '10', '12', '14', '22', '24', '26', '28', '30', '32', '34', '36', '38', '40', '42'];
const BOOTS_SIZE_OPTIONS = ['UK1', 'UK2', 'UK3', 'UK4', 'UK5', 'UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11', 'UK12', 'UK13', 'UK14', 'UK15', 'UK16', '10j', '11j', '12j', '13j', '14j'];
const GLOVES_SIZE_OPTIONS = ['YOUTH S', 'YOUTH M', 'YOUTH L', 'YOUTH XL', 'XS', 'M', 'L', 'XL', 'XXL'];
const OTHER_BRAND_VALUE = '__other__';

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

function getCreatedAtMillis(createdAt) {
  if (!createdAt) {
    return 0;
  }

  if (typeof createdAt.toDate === 'function') {
    return createdAt.toDate().getTime();
  }

  if (typeof createdAt.seconds === 'number') {
    return createdAt.seconds * 1000;
  }

  return 0;
}

export default function SellerSubmissions() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [editingSubmission, setEditingSubmission] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [brandOptions, setBrandOptions] = useState(GEAR_BRAND_OPTIONS);
  const [editImageUrls, setEditImageUrls] = useState([]);
  const [editNewFiles, setEditNewFiles] = useState([]);
  const [editForm, setEditForm] = useState({
    name: '',
    price: '',
    description: '',
    specifications: '',
    subcategory: '',
    gearItem: '',
    gearCondition: '',
    gearBrand: '',
    customGearBrand: '',
    gearSize: '',
    gearComboShirtSize: '',
    gearComboPantsSize: '',
    accessoriesSubcategory: '',
    accessoriesCondition: '',
    accessoriesBrand: '',
    customAccessoriesBrand: '',
  });

  useEffect(() => {
    let isMounted = true;

    fetchGearBrandOptions()
      .then((savedBrands) => {
        if (!isMounted) {
          return;
        }

        const mergedBrands = [...GEAR_BRAND_OPTIONS];
        savedBrands.forEach((savedBrand) => {
          const exists = mergedBrands.some((brand) => brand.toLowerCase() === savedBrand.toLowerCase());
          if (!exists) {
            mergedBrands.push(savedBrand);
          }
        });

        const sortedBrands = mergedBrands.sort((a, b) => a.localeCompare(b));
        setBrandOptions(sortedBrands);
      })
      .catch(() => {
        if (isMounted) {
          setBrandOptions(GEAR_BRAND_OPTIONS);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && user) {
      fetchSellerSubmissions(user.uid)
        .then(setSubmissions)
        .catch((err) => setError(err.message));

      fetchSellerLiveProducts(user.uid)
        .then(setProducts)
        .catch((err) => setError(err.message));
    }
  }, [loading, user]);

  const listings = useMemo(() => {
    const pendingAndRejectedRows = submissions
      .filter((submission) => submission.status === 'pending' || submission.status === 'rejected')
      .map((submission) => ({
        id: submission.id,
        productName: submission.name || 'Untitled product',
        productStatus: submission.status === 'pending' ? 'awaiting approval' : 'rejected',
        createdAtMillis: getCreatedAtMillis(submission.createdAt),
        listingType: 'submission',
        viewType: 'modal',
        canEdit: true,
        submission,
      }));

    const liveProductRows = products.map((product) => {
      const normalizedProductStatus = product.status
        || (product.marketSold ? 'purchased' : 'listed');

      return ({
      id: product.id,
      productName: product.name || 'Untitled product',
      productStatus: normalizedProductStatus,
      createdAtMillis: getCreatedAtMillis(product.createdAt),
      listingType: 'product',
      viewType: normalizedProductStatus === 'listed' ? 'shop' : 'disabled',
      canEdit: false,
      product,
    });
    });

    return [...liveProductRows, ...pendingAndRejectedRows].sort((a, b) => b.createdAtMillis - a.createdAtMillis);
  }, [products, submissions]);

  const selectedDetailEntries = selectedSubmission
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

  const selectedDetailImages = getSubmissionImages(selectedSubmission);

  const handleDeleteListing = async (listing) => {
    const shouldDelete = window.confirm('Delete this listing?');
    if (!shouldDelete) {
      return;
    }

    setDeletingId(listing.id);
    setError('');

    try {
      if (listing.listingType === 'submission') {
        await removeSellerSubmission(listing.id);
        setSubmissions((prev) => prev.filter((item) => item.id !== listing.id));
      } else {
        await removeSellerProduct(listing.id);
        setProducts((prev) => prev.filter((item) => item.id !== listing.id));
      }

      if (selectedSubmission?.id === listing.id) {
        setSelectedSubmission(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId('');
    }
  };

  const handleViewDetails = (listing) => {
    if (listing.viewType === 'shop') {
      router.push(`/product/${listing.id}`);
      return;
    }

    if (listing.viewType === 'modal') {
      setSelectedSubmission(listing.submission);
    }
  };

  const handleOpenEdit = (listing) => {
    if (!listing.canEdit || !listing.submission) {
      return;
    }

    const submission = listing.submission;
    setEditingSubmission(submission);
    setEditImageUrls(getSubmissionImages(submission));
    setEditNewFiles([]);

    const submissionGearBrand = submission.gearBrand || '';
    const submissionAccessoriesBrand = submission.accessoriesBrand || '';
    const hasSubmissionGearBrand = submissionGearBrand
      ? brandOptions.some((brand) => brand.toLowerCase() === submissionGearBrand.toLowerCase())
      : false;
    const hasSubmissionAccessoriesBrand = submissionAccessoriesBrand
      ? brandOptions.some((brand) => brand.toLowerCase() === submissionAccessoriesBrand.toLowerCase())
      : false;

    setEditForm({
      name: submission.name || '',
      price: submission.price != null ? String(submission.price) : '',
      description: submission.description || '',
      specifications: Array.isArray(submission.specifications)
        ? submission.specifications.join('\n')
        : submission.specifications || '',
      subcategory: submission.subcategory || '',
      gearItem: submission.gearItem || '',
      gearCondition: submission.gearCondition || '',
      gearBrand: submissionGearBrand
        ? hasSubmissionGearBrand
          ? submissionGearBrand
          : OTHER_BRAND_VALUE
        : '',
      customGearBrand: submissionGearBrand && !hasSubmissionGearBrand ? submissionGearBrand : '',
      gearSize: submission.gearSize || '',
      gearComboShirtSize: submission.gearComboShirtSize || '',
      gearComboPantsSize: submission.gearComboPantsSize || '',
      accessoriesSubcategory: submission.accessoriesSubcategory || submission.subcategory || '',
      accessoriesCondition: submission.accessoriesCondition || '',
      accessoriesBrand: submissionAccessoriesBrand
        ? hasSubmissionAccessoriesBrand
          ? submissionAccessoriesBrand
          : OTHER_BRAND_VALUE
        : '',
      customAccessoriesBrand: submissionAccessoriesBrand && !hasSubmissionAccessoriesBrand ? submissionAccessoriesBrand : '',
    });
  };

  const handleCloseEdit = () => {
    setEditingSubmission(null);
    setEditImageUrls([]);
    setEditNewFiles([]);
    setIsSavingEdit(false);
    setIsResubmitting(false);
  };

  const getImageValidationError = () => {
    const totalImages = editImageUrls.length + editNewFiles.length;
    const isGearOrAccessories = editingSubmission?.category === 'Gear' || editingSubmission?.category === 'Accessories';
    const minRequired = isGearOrAccessories ? 3 : 1;

    if (totalImages < minRequired) {
      return isGearOrAccessories
        ? 'Please keep at least 3 images for this listing.'
        : 'Please keep at least 1 image for this listing.';
    }

    if (totalImages > 5) {
      return 'Please keep no more than 5 images per listing.';
    }

    return '';
  };

  const buildSubmissionUpdatesWithImages = async (baseUpdates) => {
    const imageError = getImageValidationError();
    if (imageError) {
      setError(imageError);
      return null;
    }

    const existingImageUrls = getSubmissionImages(editingSubmission);
    const imageUpdates = await updateSellerSubmissionImages({
      userId: user?.uid || '',
      submissionId: editingSubmission.id,
      existingImageUrls,
      retainedImageUrls: editImageUrls,
      newFiles: editNewFiles,
    });

    return { ...baseUpdates, ...imageUpdates };
  };

  const getValidatedEditUpdates = () => {
    if (!editForm.price || Number(editForm.price) <= 0) {
      setError('Please enter a valid price greater than 0.');
      return null;
    }

    const submissionCategory = editingSubmission?.category || '';

    if (submissionCategory === 'Gear') {
      const resolvedGearBrand = editForm.gearBrand === OTHER_BRAND_VALUE ? editForm.customGearBrand.trim() : editForm.gearBrand.trim();
      const needsSingleSize = editForm.gearItem !== 'Gear Combo';
      const missingSingleSize = needsSingleSize && !editForm.gearSize.trim();
      const missingComboSizes = editForm.gearItem === 'Gear Combo' && (!editForm.gearComboShirtSize.trim() || !editForm.gearComboPantsSize.trim());

      if (!editForm.gearItem || !editForm.gearCondition || !resolvedGearBrand || missingSingleSize || missingComboSizes) {
        setError('Please complete all required gear fields before saving.');
        return null;
      }

      const resolvedGearSize = editForm.gearItem === 'Gear Combo'
        ? `Shirt: ${editForm.gearComboShirtSize.trim()}, Pants: ${editForm.gearComboPantsSize.trim()}`
        : editForm.gearSize.trim();

      return {
        name: `${resolvedGearBrand} ${editForm.gearItem.trim()}`,
        price: Number(editForm.price),
        subcategory: editForm.gearItem.trim(),
        description: '',
        specifications: [`Condition: ${editForm.gearCondition.trim()}`, `Brand: ${resolvedGearBrand}`, `Size: ${resolvedGearSize}`],
        gearItem: editForm.gearItem.trim(),
        gearCondition: editForm.gearCondition.trim(),
        gearBrand: resolvedGearBrand,
        customGearBrand: editForm.gearBrand === OTHER_BRAND_VALUE ? resolvedGearBrand : '',
        gearSize: resolvedGearSize,
        gearComboShirtSize: editForm.gearItem === 'Gear Combo' ? editForm.gearComboShirtSize.trim() : '',
        gearComboPantsSize: editForm.gearItem === 'Gear Combo' ? editForm.gearComboPantsSize.trim() : '',
      };
    }

    if (submissionCategory === 'Accessories') {
      const resolvedAccessoriesBrand = editForm.accessoriesBrand === OTHER_BRAND_VALUE ? editForm.customAccessoriesBrand.trim() : editForm.accessoriesBrand.trim();

      if (!editForm.accessoriesSubcategory || !editForm.accessoriesCondition || !resolvedAccessoriesBrand || !editForm.description.trim()) {
        setError('Please complete all required accessories fields before saving.');
        return null;
      }

      return {
        name: `${resolvedAccessoriesBrand} ${editForm.accessoriesSubcategory.trim()}`,
        price: Number(editForm.price),
        subcategory: editForm.accessoriesSubcategory.trim(),
        description: editForm.description.trim(),
        specifications: [`Condition: ${editForm.accessoriesCondition.trim()}`, `Brand: ${resolvedAccessoriesBrand}`],
        accessoriesSubcategory: editForm.accessoriesSubcategory.trim(),
        accessoriesCondition: editForm.accessoriesCondition.trim(),
        accessoriesBrand: resolvedAccessoriesBrand,
        customAccessoriesBrand: editForm.accessoriesBrand === OTHER_BRAND_VALUE ? resolvedAccessoriesBrand : '',
      };
    }

    if (!editForm.name.trim()) {
      setError('Product name is required.');
      return null;
    }

    if (!editForm.subcategory.trim() || !editForm.description.trim()) {
      setError('Please complete all required parts fields before saving.');
      return null;
    }

    return {
      name: editForm.name.trim(),
      price: Number(editForm.price),
      subcategory: editForm.subcategory.trim(),
      description: editForm.description.trim(),
      specifications: editForm.specifications
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    };
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();

    if (!editingSubmission) {
      return;
    }

    const updates = getValidatedEditUpdates();
    if (!updates) {
      return;
    }

    setIsSavingEdit(true);
    setError('');

    try {
      const updatesWithImages = await buildSubmissionUpdatesWithImages(updates);
      if (!updatesWithImages) {
        setIsSavingEdit(false);
        return;
      }

      await updateSellerSubmission(editingSubmission.id, updatesWithImages);

      setSubmissions((prev) =>
        prev.map((item) => (item.id === editingSubmission.id ? { ...item, ...updatesWithImages } : item))
      );

      if (selectedSubmission?.id === editingSubmission.id) {
        setSelectedSubmission((prev) => (prev ? { ...prev, ...updatesWithImages } : prev));
      }

      handleCloseEdit();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleResubmit = async () => {
    if (!editingSubmission) {
      return;
    }

    const baseUpdates = getValidatedEditUpdates();
    if (!baseUpdates) {
      return;
    }

    const updates = {
      ...baseUpdates,
      status: 'pending',
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: '',
    };

    setIsResubmitting(true);
    setError('');

    try {
      const updatesWithImages = await buildSubmissionUpdatesWithImages(updates);
      if (!updatesWithImages) {
        setIsResubmitting(false);
        return;
      }

      await updateSellerSubmission(editingSubmission.id, updatesWithImages);

      setSubmissions((prev) =>
        prev.map((item) => (item.id === editingSubmission.id ? { ...item, ...updatesWithImages } : item))
      );

      if (selectedSubmission?.id === editingSubmission.id) {
        setSelectedSubmission((prev) => (prev ? { ...prev, ...updatesWithImages } : prev));
      }

      handleCloseEdit();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsResubmitting(false);
    }
  };

  if (loading) {
    return <p>Loading seller data...</p>;
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Please sign in to view your submissions.</p>
        <Link href="/login" className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-white hover:bg-slate-800">
          Go to login
        </Link>
      </div>
    );
  }

  if (!profile?.canSell && profile?.role !== 'admin') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Selling is not enabled on your account yet, so there are no seller submissions to manage.</p>
        <Link href="/profile" className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-white hover:bg-slate-800">
          Go to profile
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Seller Dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">My listed products</h1>
        <p className="mt-4 text-slate-600">Track all of your product statuses and manage your listings from one table.</p>
        <Link href="/seller/submit" className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
          List new product
        </Link>
      </div>

      {error ? <p className="text-red-600">{error}</p> : null}

      {listings.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-slate-600">No listings yet.</p>
          <Link href="/seller/submit" className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-white hover:bg-slate-800">
            Submit your first product
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Product name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Product status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listings.map((listing) => (
                <tr key={`${listing.listingType}-${listing.id}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{listing.productName}</td>
                  <td className="px-4 py-3 text-slate-700 capitalize">{listing.productStatus}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewDetails(listing)}
                        disabled={listing.viewType === 'disabled'}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] ${
                          listing.viewType === 'disabled'
                            ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                            : 'border border-slate-300 text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]'
                        }`}
                      >
                        View details
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(listing)}
                        disabled={!listing.canEdit}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] ${
                          !listing.canEdit
                            ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                            : 'border border-slate-300 text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]'
                        }`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteListing(listing)}
                        disabled={deletingId === listing.id}
                        className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-white hover:bg-rose-700 disabled:opacity-60"
                      >
                        {deletingId === listing.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedSubmission ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00C5CD]">Listing details</p>
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

            {selectedSubmission.status === 'rejected' ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Admin feedback</p>
                <p className="mt-2 text-sm text-rose-900">{selectedSubmission.rejectionReason || 'No feedback provided by admin.'}</p>
              </div>
            ) : null}

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-slate-900">Submitted fields</h3>
              {selectedDetailEntries.length === 0 ? (
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
                      {selectedDetailEntries.map(([key, value]) => (
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
              {selectedDetailImages.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">No images supplied.</p>
              ) : (
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedDetailImages.map((imageSrc) => (
                    <div key={imageSrc} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      <img src={imageSrc} alt={selectedSubmission.name} className="h-48 w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {editingSubmission ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00C5CD]">Edit submission</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{editingSubmission.name}</h2>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-6 space-y-4">
              {editingSubmission.category === 'Gear' ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">What gear item do you wish to sell?</span>
                      <select
                        value={editForm.gearItem}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, gearItem: event.target.value }))}
                        required
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        {GEAR_ITEM_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Please describe the condition of the gear</span>
                      <select
                        value={editForm.gearCondition}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, gearCondition: event.target.value }))}
                        required
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        {GEAR_CONDITION_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">What brand is the gear item?</span>
                      <select
                        value={editForm.gearBrand}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, gearBrand: event.target.value }))}
                        required
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        {brandOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                        <option value={OTHER_BRAND_VALUE}>Other (Add New Brand)</option>
                      </select>
                    </label>

                    {editForm.gearBrand === OTHER_BRAND_VALUE ? (
                      <label className="block">
                        <span className="text-sm font-medium text-slate-700">Enter brand name</span>
                        <input
                          type="text"
                          value={editForm.customGearBrand}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, customGearBrand: event.target.value }))}
                          required
                          maxLength={60}
                          className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                        />
                      </label>
                    ) : null}
                  </div>

                  {ALPHA_SIZE_GEAR_ITEMS.includes(editForm.gearItem) ? (
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Please provide the size of the gear</span>
                      <select
                        value={editForm.gearSize}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, gearSize: event.target.value }))}
                        required
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        {ALPHA_SIZE_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {editForm.gearItem === 'Pants' ? (
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Please provide the size of the gear</span>
                      <select
                        value={editForm.gearSize}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, gearSize: event.target.value }))}
                        required
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        {PANTS_SIZE_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {editForm.gearItem === 'Boots' ? (
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Please provide the size of the boots</span>
                      <select
                        value={editForm.gearSize}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, gearSize: event.target.value }))}
                        required
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        {BOOTS_SIZE_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {editForm.gearItem === 'Gloves' ? (
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Please provide the size of the gloves</span>
                      <select
                        value={editForm.gearSize}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, gearSize: event.target.value }))}
                        required
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        {GLOVES_SIZE_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {editForm.gearItem === 'Gear Combo' ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-sm font-medium text-slate-700">Shirt size</span>
                        <select
                          value={editForm.gearComboShirtSize}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, gearComboShirtSize: event.target.value }))}
                          required
                          className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          {ALPHA_SIZE_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-slate-700">Pants size</span>
                        <select
                          value={editForm.gearComboPantsSize}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, gearComboPantsSize: event.target.value }))}
                          required
                          className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          {PANTS_SIZE_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}

                  {editForm.gearItem !== 'Gear Combo' && !ALPHA_SIZE_GEAR_ITEMS.includes(editForm.gearItem) && editForm.gearItem !== 'Pants' && editForm.gearItem !== 'Boots' && editForm.gearItem !== 'Gloves' ? (
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Please provide the size of the gear</span>
                      <input
                        value={editForm.gearSize}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, gearSize: event.target.value }))}
                        required
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                      />
                    </label>
                  ) : null}

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Price</span>
                    <input
                      type="number"
                      value={editForm.price}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, price: event.target.value }))}
                      required
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                    />
                  </label>
                </>
              ) : editingSubmission.category === 'Accessories' ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">What type of accessory is this?</span>
                      <select
                        value={editForm.accessoriesSubcategory}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, accessoriesSubcategory: event.target.value }))}
                        required
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        {DIRT_BIKE_CATEGORIES.Accessories.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Please describe the condition of the item</span>
                      <select
                        value={editForm.accessoriesCondition}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, accessoriesCondition: event.target.value }))}
                        required
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        {GEAR_CONDITION_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">What brand is the item?</span>
                      <select
                        value={editForm.accessoriesBrand}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, accessoriesBrand: event.target.value }))}
                        required
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        {brandOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                        <option value={OTHER_BRAND_VALUE}>Other (Add New Brand)</option>
                      </select>
                    </label>

                    {editForm.accessoriesBrand === OTHER_BRAND_VALUE ? (
                      <label className="block">
                        <span className="text-sm font-medium text-slate-700">Enter brand name</span>
                        <input
                          type="text"
                          value={editForm.customAccessoriesBrand}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, customAccessoriesBrand: event.target.value }))}
                          required
                          maxLength={60}
                          className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                        />
                      </label>
                    ) : null}
                  </div>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Description</span>
                    <textarea
                      rows="4"
                      value={editForm.description}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                      required
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Price</span>
                    <input
                      type="number"
                      value={editForm.price}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, price: event.target.value }))}
                      required
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Product name</span>
                      <input
                        value={editForm.name}
                        onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        required
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Price</span>
                      <input
                        type="number"
                        value={editForm.price}
                        onChange={e => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                        required
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Dirt Bike Category</span>
                    <select
                      value={editForm.subcategory}
                      onChange={e => setEditForm(prev => ({ ...prev, subcategory: e.target.value }))}
                      required
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <option value="">Select a category</option>
                      {DIRT_BIKE_CATEGORIES.Parts.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Fits Bike Manufacturer</span>
                    <select
                      value={editForm.manufacturer || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, manufacturer: e.target.value, model: '', otherManufacturer: '' }))}
                      required
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <option value="">Select manufacturer</option>
                      {[
                        'Honda','Yamaha','KTM','Kawasaki','Suzuki','Husqvarna','GasGas','Beta','Sherco','TM Racing','Stark Future','Fantic','Sur-Ron','Kayo','Osset','Triumph','Universal','Other'
                      ].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    {editForm.manufacturer === 'Other' && (
                      <input
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                        placeholder="Enter manufacturer name"
                        value={editForm.otherManufacturer || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, otherManufacturer: e.target.value }))}
                        required
                      />
                    )}
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Fits Bike Model</span>
                    <select
                      value={editForm.model || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, model: e.target.value }))}
                      disabled={editForm.manufacturer === 'Universal' || !editForm.manufacturer || editForm.manufacturer === 'Other'}
                      required={editForm.manufacturer !== 'Universal' && editForm.manufacturer !== 'Other'}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <option value="">{editForm.manufacturer === 'Universal' ? 'Not applicable' : 'Select model'}</option>
                      {(function() {
                        const MODELS = {
                          Honda: ['CRF450R','CRF450RWE','CRF250R','CRF250RWE','CRF450RX','CRF250RX','CRF450X','CRF250F','CRF125F','CRF110F','CRF50F'],
                          Yamaha: ['YZ450F','YZ250F','YZ250','YZ125','YZ450FX','YZ250FX','WR450F','WR250F','TT-R230','TT-R125LE','TT-R110E','TT-R50E','PW50','YZ65','YZ85'],
                          KTM: ['450 SX-F','350 SX-F','250 SX-F','300 SX','250 SX','125 SX','85 SX','65 SX','50 SX','450 XC-F','350 XC-F','250 XC-F','300 XC','250 XC'],
                          Kawasaki: ['KX450','KX250','KX112','KX85','KX65','KX450X','KX250X','KLX300R','KLX230R','KLX140R','KLX110R'],
                          Suzuki: ['RM-Z450','RM-Z250','DR-Z125L','DR-Z50','RM-250','RM-125','RM-85'],
                          Husqvarna: ['FC 450','FC 350','FC 250','TC 300','TC 250','TC 125','TC 85','TC 65','TC 50','TE 300','FE 350','FE 501','FE 450','FE 350','FE 250','TE 300','TE 250','TE 150','TE 125'],
                          GasGas: ['MC 450F','MC 250F','MC 250','MC 125','MC 85','MC 65','MC 50','EC 500F','EC 350F','EC 300.','EX 300'],
                          Beta: ['RX 350','RX 250','RX 450','125 RR Race','200 RR Race','250 RR Race','300 RR Race','350 RR Race','390 RR Race','430 RR Race','480 RR Race'],
                          Sherco: ['125 SE Factory','250 SE Factory','300 SE Factory','4-Stroke Models','250 SEF Factory','300 SEF Factory','450 SEF Factory','500 SEF Factory','250 SE Xtrem'],
                          'TM Racing': ['EN 125 Fi','EN 144 Fi','EN 250 Fi','EN 300 Fi','EN 250Fi','EN 300Fi','EN 450Fi','MX 85','MX 125','MX 144','MX 250','MX 300','MX 250Fi','MX 300Fi','MX 450Fi'],
                          'Stark Future': ['VARG MX','VARG EX'],
                          Fantic: ['XEF 450','XEF 310','XEF 250','XE 300','XE 125','XEF 125','XE 50','XXF 450','XXF 250','XX 250','XX 125'],
                          'Sur-Ron': ['Light Bee X','Light Bee L1E','Light Bee S','Ultra Bee','Ultra Bee T','Ultra Bee R','Storm Bee F','Storm Bee E','Storm Bee R'],
                          Osset: ['TXP-24','TXP-20','TXP-16','TXP-12'],
                          Triumph: ['TF 450-X','TF 250-X','TF 250-C','TF 450-C','TF 250-E','TF 450-E'],
                        };
                        return MODELS[editForm.manufacturer] ? MODELS[editForm.manufacturer].map(mod => (
                          <option key={mod} value={mod}>{mod}</option>
                        )) : null;
                      })()}
                    </select>
                  </label>
                </>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">Listing photos</h3>
                  <p className="text-xs text-slate-600">{editImageUrls.length + editNewFiles.length}/5 selected</p>
                </div>

                {editImageUrls.length > 0 ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {editImageUrls.map((imageSrc) => (
                      <div key={imageSrc} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <img src={imageSrc} alt="Listing" className="h-40 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setEditImageUrls((prev) => prev.filter((item) => item !== imageSrc))}
                          className="w-full border-t border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-rose-700 hover:bg-rose-50"
                        >
                          Remove photo
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">No existing photos kept.</p>
                )}

                <label className="mt-4 block">
                  <span className="text-sm font-medium text-slate-700">Add new photos</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => setEditNewFiles(Array.from(event.target.files || []))}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3"
                  />
                </label>

                {editNewFiles.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {editNewFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="truncate text-sm text-slate-700">{file.name}</p>
                        <button
                          type="button"
                          onClick={() => setEditNewFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}
                          className="text-xs font-semibold uppercase tracking-[0.06em] text-rose-700"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingEdit || isResubmitting}
                  className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSavingEdit ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={handleResubmit}
                  disabled={isSavingEdit || isResubmitting}
                  className="rounded-full bg-[#00CED1] px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#00C5CD] disabled:opacity-60"
                >
                  {isResubmitting ? 'Resubmitting...' : 'Resubmit'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  disabled={isSavingEdit || isResubmitting}
                  className="rounded-full border border-slate-300 px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
