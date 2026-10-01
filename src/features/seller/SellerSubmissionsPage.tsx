import Link from 'next/link';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/router';
import useAuth from '@/lib/useAuth';
import { SERVICE_FEE_WAIVED_LABEL } from '@/lib/api/catalog';
import { type SellerListing, toSubmissionInput } from '@/lib/api/submissions';
import type { CatalogConfig } from '@/lib/api/types';
import { useCatalogConfig } from '@/lib/queries/catalog';
import { flattenPages } from '@/lib/queries/pagination';
import {
  useDeleteSubmission,
  useEditLiveProduct,
  useMyProduct,
  useMyProducts,
  useMySubmissions,
  useRemoveMyProduct,
  useUpdateSubmission,
} from '@/lib/queries/submissions';
import { toUserMessage } from '@/lib/userMessage';
import { useSingleFlight } from '@/lib/useSingleFlight';
import ImageCropDialog from '@/components/ImageCropDialog';
import ListingFormFields from './ListingFormFields';
import ServiceFeeNote from '@/components/ServiceFeeNote';
import { useListingImages } from './useListingImages';
import { LISTING_IMAGE_ASPECT, LISTING_IMAGE_OUTPUT_WIDTH } from '@/lib/cropImage';
import {
  MAX_LISTING_IMAGES,
  MIN_LISTING_IMAGES,
  describeSubmissionError,
  formFromListing,
  validateListingForm,
  type ListingFormErrors,
  type ListingFormState,
} from '@/lib/listingForm';

const PAGE_SIZE = 25;

// Why: display copy for submission and product statuses in the listings table.
const STATUS_LABELS: Record<string, string> = {
  pending: 'awaiting approval',
  rejected: 'rejected',
  listed: 'listed',
  sold_out: 'sold out',
};

// Why: products in these states are not shown as live listings: a pending edit appears as its own
// pending submission instead, and removed products are gone.
const HIDDEN_PRODUCT_STATUSES = new Set<string | undefined>(['pending_review', 'removed']);

/** One row of the listings table: a submission or a live product. */
interface ListingRow {
  id: string;
  productName: string;
  productStatus: string | undefined;
  createdAtMillis: number;
  listingType: 'submission' | 'product';
  viewType: 'modal' | 'shop' | 'disabled';
  canEdit: boolean;
  item: SellerListing;
}

/** The listing open in the edit dialog, and whether it is a submission or a live product. */
interface EditingListing {
  listing: SellerListing;
  kind: 'submission' | 'product';
}

/**
 * Why: Shows a listing's price in the same "R 450.00" style the storefront uses.
 * @param rands - Amount in rands.
 * @returns The formatted amount.
 * @example
 * formatRandAmount(450); // 'R 450.00'
 */
function formatRandAmount(rands: number): string {
  return `R ${rands.toFixed(2)}`;
}

/**
 * Why: The "Listing details" dialog shows a submission's fields as label/value rows; this builds
 * them from the adapted listing so the dialog no longer dumps raw database fields.
 * @param listing - A listing from `toSellerListing()`.
 * @returns `[label, value]` rows, without empty values.
 * @example
 * getDetailRows(listing); // [['Category', 'Gear'], ['Your price', 'R 450.00'], ...]
 */
function getDetailRows(listing: SellerListing): Array<[string, string]> {
  const size = listing.comboSizes
    ? `Shirt ${listing.comboSizes.shirt}, Pants ${listing.comboSizes.pants}`
    : listing.size;
  const rows: Array<[string, string]> = [
    ['Category', listing.category],
    ['Subcategory', listing.subcategory],
    ['Condition', listing.conditionLabel],
    ['Brand', listing.brand],
    ['Size', size],
    ['Fits manufacturer', listing.universalFit ? 'Universal fit' : listing.manufacturer],
    ['Fits models', listing.models.join(', ')],
    ['Quantity', String(listing.quantity)],
    ['Description', listing.description],
    ['Your price', formatRandAmount(listing.sellerPrice)],
    ['Buyers pay', formatRandAmount(listing.price)],
    ['Service fee', listing.serviceFeeWaived ? SERVICE_FEE_WAIVED_LABEL : ''],
    ['Submitted', listing.createdAt ? new Date(listing.createdAt).toLocaleString() : ''],
  ];
  return rows.filter(([, value]) => value);
}

/**
 * Why: Seller page listing the seller's submissions (pending, rejected) and live products with
 * cursor pagination, plus editing, resubmitting, deleting and removing them through the backend.
 * Editing a live product takes it off sale until it is re-approved.
 * @returns The seller's listings, or a sign-in / not-a-seller prompt.
 * @example
 * // Rendered by Next.js at /seller/submissions
 */
export default function SellerSubmissions() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <p>Loading seller data...</p>;
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Please sign in to view your submissions.</p>
        <Link
          href="/login"
          className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-white hover:bg-slate-800"
        >
          Go to login
        </Link>
      </div>
    );
  }

  if (!profile?.canSell) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">
          Selling is not enabled on your account yet, so there are no seller submissions to manage.
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

  return <SellerListings />;
}

/**
 * Why: Only a seller who can sell has listings to load, so the queries live in their own
 * component that mounts after the sign-in and seller checks.
 * @returns The listings table with its edit and details dialogs.
 */
function SellerListings() {
  const router = useRouter();
  const images = useListingImages();
  const { data: config, error: configError } = useCatalogConfig();
  const submissionsQuery = useMySubmissions(undefined, PAGE_SIZE);
  const productsQuery = useMyProducts(PAGE_SIZE);
  const submissions = useMemo(() => flattenPages(submissionsQuery.data), [submissionsQuery.data]);
  const products = useMemo(() => flattenPages(productsQuery.data), [productsQuery.data]);
  const deleteSubmission = useDeleteSubmission();
  const removeMyProduct = useRemoveMyProduct();
  const updateSubmission = useUpdateSubmission();
  const editLiveProduct = useEditLiveProduct();
  const { run: runLoadMore, pending: isLoadingMore } = useSingleFlight();
  const { run: runDelete, pending: isDeleting } = useSingleFlight();
  const [actionError, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('');
  const selectedSubmission = submissions.find((item) => item.id === selectedSubmissionId) ?? null;
  const [editing, setEditing] = useState<EditingListing | null>(null);
  const [editForm, setEditForm] = useState<ListingFormState | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<ListingFormErrors>({});
  const [editStatus, setEditStatus] = useState('');
  const [editShowProfileLink, setEditShowProfileLink] = useState(false);
  const { run: runSaveEdit, pending: isSavingEdit } = useSingleFlight();
  // Why: A live product's list row lacks its description, sizes, fitment and image ids, so the
  // full product is fetched when the seller opens its edit dialog.
  const [productEditId, setProductEditId] = useState('');
  const productToEdit = useMyProduct(productEditId);
  const preparingEditId =
    productEditId && !editing && productToEdit.isFetching ? productEditId : '';
  const isPreparingEdit = Boolean(preparingEditId);

  let loadError = '';
  if (configError) {
    loadError = toUserMessage(
      configError,
      "We couldn't load the listing options right now. Please try again.",
    );
  } else if (submissionsQuery.error || productsQuery.error) {
    loadError = toUserMessage(
      submissionsQuery.error ?? productsQuery.error,
      submissionsQuery.isFetchNextPageError || productsQuery.isFetchNextPageError
        ? "We couldn't load more listings right now. Please try again."
        : "We couldn't load your listings right now. Please try again.",
    );
  } else if (productEditId && productToEdit.isError) {
    loadError = toUserMessage(
      productToEdit.error,
      "We couldn't open that listing for editing right now. Please try again.",
    );
  }
  const error = actionError || loadError;

  /**
   * Why: Cursor pagination: fetches the next page of whichever lists still have more.
   * @example
   * <button onClick={handleLoadMore}>Load more</button>
   */
  const handleLoadMore = () => {
    setError('');
    return runLoadMore(() =>
      Promise.all([
        submissionsQuery.hasNextPage ? submissionsQuery.fetchNextPage() : null,
        productsQuery.hasNextPage ? productsQuery.fetchNextPage() : null,
      ]),
    );
  };

  const listings = useMemo<ListingRow[]>(() => {
    const submissionRows = submissions
      .filter((submission) => submission.status === 'pending' || submission.status === 'rejected')
      .map((submission) => ({
        id: submission.id,
        productName: submission.name || 'Untitled product',
        productStatus: STATUS_LABELS[submission.status ?? ''],
        createdAtMillis: submission.createdAtMillis,
        listingType: 'submission' as const,
        viewType: 'modal' as const,
        canEdit: true,
        item: submission,
      }));

    const productRows = products
      .filter((product) => !HIDDEN_PRODUCT_STATUSES.has(product.status))
      .map((product) => ({
        id: product.id,
        productName: product.name || 'Untitled product',
        productStatus: STATUS_LABELS[product.status ?? ''] || product.status,
        createdAtMillis: product.createdAtMillis,
        listingType: 'product' as const,
        viewType: product.status === 'listed' ? ('shop' as const) : ('disabled' as const),
        canEdit: product.status === 'listed',
        item: product,
      }));

    return [...productRows, ...submissionRows].sort(
      (a, b) => b.createdAtMillis - a.createdAtMillis,
    );
  }, [products, submissions]);

  /**
   * Why: Deletes a pending or rejected submission, or removes a live product from the shop.
   * @param listing - A row from `listings`.
   * @example
   * <button onClick={() => handleDeleteListing(listing)}>Delete</button>
   */
  const handleDeleteListing = (listing: ListingRow) =>
    runDelete(async () => {
      const shouldDelete = window.confirm(
        listing.listingType === 'product'
          ? 'Remove this listing from the shop?'
          : 'Delete this listing?',
      );
      if (!shouldDelete) {
        return;
      }

      setDeletingId(listing.id);
      setError('');

      try {
        if (listing.listingType === 'submission') {
          await deleteSubmission.mutateAsync(listing.id);
        } else {
          await removeMyProduct.mutateAsync(listing.id);
        }

        if (selectedSubmissionId === listing.id) {
          setSelectedSubmissionId('');
        }
      } catch (err) {
        setError(
          toUserMessage(err, "We couldn't delete that listing right now. Please try again."),
        );
      } finally {
        setDeletingId('');
      }
    });

  /**
   * Why: Live products open their storefront page; submissions open the details dialog.
   * @param listing - A row from `listings`.
   * @example
   * <button onClick={() => handleViewDetails(listing)}>View details</button>
   */
  const handleViewDetails = (listing: ListingRow) => {
    if (listing.viewType === 'shop') {
      router.push(`/product/${listing.id}`);
      return;
    }

    if (listing.viewType === 'modal') {
      setSelectedSubmissionId(listing.item.id);
    }
  };

  /**
   * Why: Opens the edit dialog prefilled from the listing.
   * @param source - The listing to edit: a submission, or the full live product.
   * @param kind - Whether it is a submission or a live product.
   * @param catalogConfig - The listing options the form is built from.
   * @example
   * beginEdit(listing.item, 'submission', config);
   */
  const beginEdit = (
    source: SellerListing,
    kind: EditingListing['kind'],
    catalogConfig: CatalogConfig,
  ) => {
    setProductEditId('');
    setEditing({ listing: source, kind });
    setEditForm(formFromListing(source, catalogConfig));
    setEditFieldErrors({});
    setEditStatus('');
    setEditShowProfileLink(false);
    images.reset(source.imageItems);
  };

  /**
   * Why: A submission opens at once; a live product asks for its full details first.
   * @param listing - A row from `listings`.
   * @example
   * <button onClick={() => handleOpenEdit(listing)}>Edit</button>
   */
  const handleOpenEdit = (listing: ListingRow) => {
    if (!listing.canEdit || !config) {
      return;
    }

    setError('');

    if (listing.listingType === 'product') {
      if (productEditId !== listing.id) setProductEditId(listing.id);
      else if (productToEdit.isError) void productToEdit.refetch();
      return;
    }

    beginEdit(listing.item, 'submission', config);
  };

  // Why: The product's details arrive after the click, so the dialog opens during render once they
  // are in, instead of from an effect.
  if (productEditId && config && !editing && productToEdit.data && !productToEdit.isFetching) {
    beginEdit(productToEdit.data, 'product', config);
  }

  /**
   * Why: Closes the edit dialog and drops its in-progress state.
   * @example
   * <button onClick={handleCloseEdit}>Cancel</button>
   */
  const handleCloseEdit = () => {
    setEditing(null);
    setEditForm(null);
    setEditFieldErrors({});
    setEditStatus('');
    images.reset();
  };

  /**
   * Why: Field components report changes as patches so one handler serves every field.
   * @param patch - Form fields to overwrite.
   * @example
   * handleEditFormChange({ price: '450' });
   */
  const handleEditFormChange = (patch: Partial<ListingFormState>) => {
    setEditForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  /**
   * Why: Saves an edit to a pending submission, resubmits a rejected one (`PUT`), or submits an
   * edit of a live product (`POST /me/products/{id}/edit`), uploading the kept image ids plus the
   * newly cropped files.
   * @param event - The form submit event.
   * @example
   * <form onSubmit={handleSaveEdit}>
   */
  const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editing || !editForm) {
      return;
    }

    const errors = validateListingForm(editForm, config, images.total);
    setEditFieldErrors(errors);
    setEditShowProfileLink(false);
    if (Object.keys(errors).length > 0) {
      setEditStatus('Please fix the highlighted fields.');
      return;
    }

    setEditStatus('');

    try {
      await runSaveEdit(async () => {
        const payload = {
          input: toSubmissionInput(editForm, { keepImageIds: images.keepImageIds }),
          files: images.files,
        };
        if (editing.kind === 'product') {
          await editLiveProduct.mutateAsync({ productId: editing.listing.id, ...payload });
        } else {
          await updateSubmission.mutateAsync({ id: editing.listing.id, ...payload });
        }

        handleCloseEdit();
      });
    } catch (err) {
      const failure = describeSubmissionError(
        err,
        "We couldn't save your changes right now. Please try again.",
      );
      setEditStatus(failure.message);
      setEditFieldErrors(failure.fieldErrors);
      setEditShowProfileLink(failure.showProfileLink);
    }
  };

  const isProductEdit = editing?.kind === 'product';
  const isRejectedResubmit =
    editing?.kind === 'submission' && editing.listing.status === 'rejected';
  const editStatusMessage = editStatus || images.notice;
  let saveLabel = 'Save changes';
  if (isProductEdit) saveLabel = 'Submit edit for approval';
  if (isRejectedResubmit) saveLabel = 'Resubmit';

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <ImageCropDialog
        file={images.cropQueue.currentFile}
        aspect={LISTING_IMAGE_ASPECT}
        maxWidth={LISTING_IMAGE_OUTPUT_WIDTH}
        title="Crop listing photo"
        progressLabel={images.cropQueue.progressLabel}
        onConfirm={images.cropQueue.confirm}
        onSkip={images.cropQueue.skip}
      />
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--mx-tertiary)]">
            Seller centre
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
            Seller Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage your listings and keep their details up to date.
          </p>
        </div>
        <Link
          href="/seller/submit"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          List new product
        </Link>
      </section>

      <Accordion
        disableGutters
        elevation={0}
        sx={{
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          borderRadius: '16px !important',
          backgroundColor: '#ffffff',
          boxShadow: '0 1px 2px rgb(15 23 42 / 0.08)',
          '&:before': { display: 'none' },
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="seller-listings-content"
          id="seller-listings-header"
          sx={{
            minHeight: 64,
            px: { xs: 2, sm: 3 },
            '&.Mui-expanded': { minHeight: 64 },
            '& .MuiAccordionSummary-content': { my: 1.25 },
            '& .MuiAccordionSummary-content.Mui-expanded': { my: 1.25 },
            '& .MuiAccordionSummary-expandIconWrapper': { color: '#64748b' },
          }}
        >
          <div>
            <p className="text-base font-semibold text-slate-900">My listed products</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {listings.length} {listings.length === 1 ? 'listing' : 'listings'} to manage
            </p>
          </div>
        </AccordionSummary>
        <AccordionDetails id="seller-listings-content" sx={{ px: { xs: 2, sm: 3 }, pb: 3, pt: 0 }}>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">
              Track product statuses and manage listings from one table.
            </p>

            {error ? <p className="mt-4 text-red-600">{error}</p> : null}

            {listings.length === 0 ? (
              <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <p className="text-slate-600">No listings yet.</p>
                <Link
                  href="/seller/submit"
                  className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-white hover:bg-slate-800"
                >
                  Submit your first product
                </Link>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Product name
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Product status
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {listings.map((listing) => (
                      <tr
                        key={`${listing.listingType}-${listing.id}`}
                        className="hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 text-slate-900">
                          {listing.productName}
                          <ServiceFeeNote waived={listing.item.serviceFeeWaived} />
                        </td>
                        <td className="px-4 py-3 text-slate-700 capitalize">
                          {listing.productStatus}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewDetails(listing)}
                              disabled={listing.viewType === 'disabled'}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] ${listing.viewType === 'disabled' ? 'cursor-not-allowed bg-slate-200 text-slate-500' : 'border border-slate-300 text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]'}`}
                            >
                              View details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(listing)}
                              disabled={!listing.canEdit || isPreparingEdit}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] ${!listing.canEdit ? 'cursor-not-allowed bg-slate-200 text-slate-500' : 'border border-slate-300 text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]'}`}
                            >
                              {preparingEditId === listing.id ? 'Opening...' : 'Edit'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteListing(listing)}
                              disabled={isDeleting}
                              className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-white hover:bg-rose-700 disabled:opacity-60"
                            >
                              {deletingId === listing.id
                                ? 'Deleting...'
                                : listing.listingType === 'product'
                                  ? 'Remove'
                                  : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {submissionsQuery.hasNextPage || productsQuery.hasNextPage ? (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="mt-4 rounded-full border border-slate-300 px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD] disabled:opacity-60"
              >
                {isLoadingMore ? 'Loading...' : 'Load more'}
              </button>
            ) : null}
          </div>
        </AccordionDetails>
      </Accordion>

      {selectedSubmission ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00C5CD]">
                  Listing details
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  {selectedSubmission.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmissionId('')}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
              >
                Close
              </button>
            </div>

            {selectedSubmission.status === 'rejected' ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">
                  Admin feedback
                </p>
                <p className="mt-2 text-sm text-rose-900">
                  {selectedSubmission.rejectionReason || 'No feedback provided by admin.'}
                </p>
              </div>
            ) : null}

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-slate-900">Submitted fields</h3>
              <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Field</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {getDetailRows(selectedSubmission).map(([label, value]) => (
                      <tr key={label}>
                        <td className="px-4 py-3 align-top text-slate-700">{label}</td>
                        <td className="px-4 py-3 text-slate-900">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-slate-900">Images supplied</h3>
              {selectedSubmission.images.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">No images supplied.</p>
              ) : (
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedSubmission.images.map((imageSrc) => (
                    <div
                      key={imageSrc}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
                    >
                      <img
                        src={imageSrc}
                        alt={selectedSubmission.name}
                        className="h-48 w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {editing && editForm && config ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00C5CD]">
                  {isProductEdit ? 'Edit live listing' : 'Edit submission'}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  {editing.listing.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
              >
                Close
              </button>
            </div>

            {isProductEdit ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-900">
                  Editing a live listing takes it off sale until an admin approves your changes.
                  Until then buyers cannot see or buy it.
                </p>
              </div>
            ) : null}

            <form onSubmit={handleSaveEdit} className="mt-6 space-y-4">
              <ListingFormFields
                form={editForm}
                onChange={handleEditFormChange}
                config={config}
                errors={editFieldErrors}
                serviceFeeWaived={editing.listing.serviceFeeWaived}
              />

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">
                    Listing photos
                  </h3>
                  <p className="text-xs text-slate-600">
                    {images.total}/{MAX_LISTING_IMAGES} selected
                  </p>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  Keep or add between {MIN_LISTING_IMAGES} and {MAX_LISTING_IMAGES} photos.
                </p>
                {editFieldErrors.images ? (
                  <p className="mt-1 text-xs text-red-600">{editFieldErrors.images}</p>
                ) : null}

                {images.kept.length > 0 ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {images.kept.map((image, index) => (
                      <div
                        key={image.id}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                      >
                        <img
                          src={image.thumbnailUrl || image.url}
                          alt="Listing"
                          className="h-40 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => images.removeKept(index)}
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
                    onChange={images.handleFilesChange}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3"
                  />
                </label>

                {images.previews.length > 0 ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {images.previews.map((item, index) => (
                      <div
                        key={item.id}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                      >
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="h-32 w-full object-cover"
                        />
                        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-3 py-2">
                          <p className="truncate text-xs text-slate-600" title={item.name}>
                            {item.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => images.removeFile(index)}
                            className="text-xs font-semibold uppercase tracking-[0.06em] text-rose-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {editStatusMessage ? (
                <p className="text-sm text-red-600">
                  {editStatusMessage}
                  {editShowProfileLink ? (
                    <>
                      {' '}
                      <Link href="/profile" className="font-semibold underline">
                        Go to your profile
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSavingEdit ? 'Saving...' : saveLabel}
                </button>
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  disabled={isSavingEdit}
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
