import Link from 'next/link';
import { useEffect, useState } from 'react';
import useAuth from '../../lib/useAuth';
import { fetchCatalogConfig } from '../../lib/api/catalog';
import { createSubmission, toSubmissionInput } from '../../lib/api/submissions';
import { toUserMessage } from '../../lib/userMessage';
import ImageCropDialog from '../../components/ImageCropDialog';
import ListingFormFields from '../../components/ListingFormFields';
import { useListingImages } from '../../lib/useListingImages';
import { LISTING_IMAGE_ASPECT, LISTING_IMAGE_OUTPUT_WIDTH } from '../../lib/cropImage';
import {
  MAX_LISTING_IMAGES,
  MIN_LISTING_IMAGES,
  describeSubmissionError,
  emptyListingForm,
  validateListingForm,
} from '../../lib/listingForm';

// Why: the seller-facing name of the parts category differs from the storefront label.
const SELL_CATEGORY_LABEL_OVERRIDES = { parts: 'Dirt Bike Parts' };

/**
 * Why: Seller page for listing a new product. It loads the form options from the backend catalog
 * config, collects the seller's own price (the backend adds the service fee) and 3-5 cropped
 * photos (D-13), and posts them as one multipart submission for admin review.
 * @returns {JSX.Element} The category picker, the listing form, or a sign-in / not-a-seller prompt.
 * @example
 * // Rendered by Next.js at /seller/submit
 */
export default function SellerSubmit() {
  const { user, profile, loading } = useAuth();
  const images = useListingImages();
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState('');
  const [showProfileLink, setShowProfileLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  useEffect(() => {
    let isMounted = true;

    fetchCatalogConfig()
      .then((result) => {
        if (isMounted) setConfig(result);
      })
      .catch((error) => {
        if (isMounted) setStatus(toUserMessage(error, "We couldn't load the listing options right now. Please try again."));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      setStatus('Please log in to submit products.');
    }
  }, [loading, user]);

  /**
   * Why: Starts the form for the chosen category with that category's default selections.
   * @param {string} categoryKey - `gear`, `parts` or `accessories`.
   * @returns {void}
   * @example
   * handleCategoryChoice('gear');
   */
  const handleCategoryChoice = (categoryKey) => {
    setForm(emptyListingForm(categoryKey, config));
    setFieldErrors({});
    setStatus('');
  };

  /**
   * Why: Field components report changes as patches so one handler serves every field.
   * @param {object} patch - Form fields to overwrite.
   * @returns {void}
   * @example
   * handleFormChange({ price: '450' });
   */
  const handleFormChange = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  /**
   * Why: Validates, then uploads the listing as one multipart request, and maps the backend's
   * 422 field errors and 403/409 conditions to friendly messages.
   * @param {Event} event - The form submit event.
   * @returns {Promise<void>}
   * @example
   * <form onSubmit={handleSubmit}>
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user || !form) return;

    const errors = validateListingForm(form, config, images.total);
    setFieldErrors(errors);
    setShowProfileLink(false);
    if (Object.keys(errors).length > 0) {
      setStatus('Please fix the highlighted fields.');
      return;
    }

    setIsSubmitting(true);
    setStatus('');

    try {
      await createSubmission({ input: toSubmissionInput(form), files: images.files });
      setForm(emptyListingForm(form.category, config));
      images.reset();
      setShowSuccessPopup(true);
    } catch (error) {
      const failure = describeSubmissionError(error, "We couldn't submit your listing right now. Please try again.");
      setStatus(failure.message);
      setFieldErrors(failure.fieldErrors);
      setShowProfileLink(failure.showProfileLink);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusMessage = status || images.notice;
  const statusLine = statusMessage ? (
    <p className="mt-4 text-slate-600">
      {statusMessage}
      {showProfileLink ? (
        <>
          {' '}
          <Link href="/profile" className="font-semibold underline">Go to your profile</Link>
        </>
      ) : null}
    </p>
  ) : null;

  if (loading) {
    return <p>Loading seller submission form...</p>;
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Please sign in to submit products.</p>
      </div>
    );
  }

  if (!profile?.canSell) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Your account is not enabled for selling yet. Complete your profile to unlock product listings.</p>
        <Link href="/profile" className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-white hover:bg-slate-800">
          Go to profile
        </Link>
      </div>
    );
  }

  if (!config) {
    return <p>{status || 'Loading seller submission form...'}</p>;
  }

  if (!form) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Seller</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">What are you selling?</h1>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {config.categories.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => handleCategoryChoice(item.key)}
              className="rounded-3xl border border-slate-300 bg-[#eceff3] px-5 py-6 text-center text-sm font-semibold uppercase tracking-[0.08em] text-slate-800 transition hover:border-[#00CED1] hover:text-[#00C5CD]"
            >
              {SELL_CATEGORY_LABEL_OVERRIDES[item.key] || item.label}
            </button>
          ))}
        </div>

        {status ? <p className="mt-6 text-slate-600">{status}</p> : null}
      </div>
    );
  }

  const selectedCategory = config.categories.find((item) => item.key === form.category);

  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Seller</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Submit new product</h1>
      </div>
      <ImageCropDialog
        file={images.cropQueue.currentFile}
        aspect={LISTING_IMAGE_ASPECT}
        maxWidth={LISTING_IMAGE_OUTPUT_WIDTH}
        title="Crop listing photo"
        progressLabel={images.cropQueue.progressLabel}
        onConfirm={images.cropQueue.confirm}
        onSkip={images.cropQueue.skip}
      />
      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Selected category</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{SELL_CATEGORY_LABEL_OVERRIDES[form.category] || selectedCategory?.label}</p>
          </div>
          <button
            type="button"
            onClick={() => setForm(null)}
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
          >
            Change category
          </button>
        </div>

        <ListingFormFields form={form} onChange={handleFormChange} config={config} errors={fieldErrors} />

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Please upload {MIN_LISTING_IMAGES}-{MAX_LISTING_IMAGES} clear images of item</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={images.handleFilesChange}
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
          />
          <p className="mt-2 text-sm text-slate-500">
            Please upload between {MIN_LISTING_IMAGES} and {MAX_LISTING_IMAGES} images.
          </p>
          {fieldErrors.images ? <p className="mt-1 text-xs text-red-600">{fieldErrors.images}</p> : null}

          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">Selected images</p>
              <p className="text-xs text-slate-600">{images.files.length}/{MAX_LISTING_IMAGES} selected</p>
            </div>

            {images.previews.length > 0 ? (
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {images.previews.map((item, index) => (
                  <div key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <img src={item.previewUrl} alt={item.name} className="h-32 w-full object-cover" />
                    <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2">
                      <p className="truncate text-xs text-slate-600" title={item.name}>{item.name}</p>
                      <button
                        type="button"
                        onClick={() => images.removeFile(index)}
                        className="text-xs font-semibold uppercase tracking-[0.06em] text-rose-700 hover:text-rose-800"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No images selected yet.</p>
            )}
          </div>
        </label>
        <button disabled={isSubmitting} className="rounded-3xl bg-slate-900 px-6 py-3 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmitting ? 'Submitting…' : 'Submit for review'}
        </button>
      </form>
      {statusLine}

      {showSuccessPopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00C5CD]">Submission successful</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Submitted successfully</h2>
            <p className="mt-3 text-sm text-slate-600">Your product has been submitted for review and is now pending admin approval.</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowSuccessPopup(false)}
                className="rounded-full bg-[#00CED1] px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#00C5CD]"
              >
                Submit another
              </button>
              <Link href="/seller/submissions" className="rounded-full border border-slate-300 px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]">
                View submissions
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
