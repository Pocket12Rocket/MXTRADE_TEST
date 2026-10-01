import { apiRequest } from '@/lib/apiClient';
import type {
  Condition,
  Image,
  ImageRef,
  ProductStatus,
  SellerProduct,
  SellerProductDetail,
  SellerProductPage,
  ServiceFeeQuote,
  Submission,
  SubmissionInput,
  SubmissionPage,
  SubmissionStatus,
  Category,
} from '@/lib/api/types';
import { CATEGORY_LABELS, centsToRands, randsToCents } from './catalog';
import {
  OTHER_BRAND_VALUE,
  OTHER_MANUFACTURER,
  OTHER_SUBCATEGORY_VALUE,
  UNIVERSAL_MANUFACTURER,
  parseModelInput,
  resolveOther,
} from '@/lib/listingForm';
import type { ListingFormState } from '@/lib/listingForm';

/** The request body for creating or editing a listing; `keepImageIds` is sent on edits only. */
export type SubmissionPayload = Omit<SubmissionInput, 'keepImageIds'> & { keepImageIds?: string[] };

/** What `toSellerListing` accepts from the API. */
export type ListingSource = Submission | SellerProduct | SellerProductDetail;

/** One listing photo; `id` is missing when the API only gave a primary image URL. */
export interface SellerListingImage {
  id: string | undefined;
  url: string;
  thumbnailUrl: string;
}

/** A seller's listing as the seller pages render it: a submission or a live product. */
export interface SellerListing {
  id: string;
  kind: 'submission' | 'product';
  /** A submission's review status, or a product's sale status (undefined on some details). */
  status: SubmissionStatus | ProductStatus | undefined;
  rejectionReason: string;
  name: string;
  /** Display label (`Gear`). */
  category: string;
  categoryKey: Category;
  subcategory: string;
  description: string;
  condition: Condition;
  conditionLabel: string;
  brand: string;
  manufacturer: string;
  models: string[];
  universalFit: boolean;
  size: string;
  comboSizes: { shirt: string; pants: string } | null;
  quantity: number;
  /** What buyers pay, in rands. */
  price: number;
  /** What the seller is paid, in rands. */
  sellerPrice: number;
  sellerPriceCents: number;
  markupPercent: number | null;
  serviceFeeWaived: boolean;
  images: string[];
  imageItems: SellerListingImage[];
  thumbnails: string[];
  primaryImage: string | null;
  primaryThumbnail: string | null;
  originalProductId: string | null;
  productId: string | null;
  pendingEditId: string | null;
  createdAt: string | null;
  createdAtMillis: number;
  updatedAt: string | null;
}

/** One page of seller listings. */
export interface SellerListingPage {
  items: SellerListing[];
  nextCursor: string | null;
}

/** Request parts of a create or edit call. */
interface ListingRequest {
  input: SubmissionPayload;
  files: File[];
}

/**
 * Why: Seller listing calls (`/v1/me/submissions*`, `/v1/me/products*`, `/v1/pricing/service-fee-quote`).
 * Listings are multipart requests: a `data` field with the JSON `SubmissionInput` plus 3-5 cropped
 * photos (counting kept images) under `images`.
 */

/**
 * Why: Turns the seller form's state into the `SubmissionInput` the backend expects, so the create
 * and edit flows build requests the same way. Prices go over the API as integer cents.
 * @param form - Form state from `lib/listingForm.ts` (`emptyListingForm`/`formFromListing`).
 * @param options - Options.
 * @param options.keepImageIds - Existing image ids to keep, in order; pass it on
 *   edits only (omit for a new submission).
 * @returns The `SubmissionInput` (see the contract, section 1).
 * @example
 * const input = toSubmissionInput(form, { keepImageIds: ['img-1', 'img-2'] });
 */
export function toSubmissionInput(
  form: ListingFormState,
  { keepImageIds }: { keepImageIds?: string[] } = {},
): SubmissionPayload {
  const isGear = form.category === 'gear';
  const isParts = form.category === 'parts';
  const isUniversal = isParts && form.manufacturer === UNIVERSAL_MANUFACTURER;
  const comboSizes =
    isGear && form.comboShirt && form.comboPants
      ? { shirt: form.comboShirt, pants: form.comboPants }
      : null;

  const manufacturer =
    isParts && !isUniversal
      ? resolveOther(form.manufacturer, form.otherManufacturer, OTHER_MANUFACTURER)
      : '';
  const models =
    isParts && !isUniversal
      ? Array.from(
          new Set([
            ...form.models.map((model) => model.trim()).filter(Boolean),
            ...parseModelInput(form.customModels),
          ]),
        )
      : [];

  const input: SubmissionPayload = {
    category: form.category,
    subcategory: resolveOther(form.subcategory, form.customSubcategory, OTHER_SUBCATEGORY_VALUE),
    // Why: the backend names gear and accessories "<brand> <subcategory>" itself; only parts have a typed name.
    name: isParts ? form.name.trim() : null,
    description: form.description.trim(),
    // The form holds the select's raw value; the backend validates it against the catalog.
    condition: form.condition as Condition,
    brand: resolveOther(form.brand, form.customBrand, OTHER_BRAND_VALUE) || null,
    manufacturer: manufacturer || null,
    models,
    universalFit: isUniversal,
    size: isGear && !comboSizes ? form.size.trim() || null : null,
    comboSizes,
    quantity: Number(form.quantity),
    sellerPriceCents: randsToCents(form.price),
  };

  if (Array.isArray(keepImageIds)) {
    input.keepImageIds = keepImageIds;
  }
  return input;
}

/**
 * Why: The multipart body every create and edit call shares.
 * @param input - The `SubmissionInput`.
 * @param files - New (already cropped) images, in display order.
 * @returns `data` (the JSON input) plus one `images` part per file.
 * @example
 * const body = buildSubmissionFormData(input, croppedFiles);
 */
export function buildSubmissionFormData(input: SubmissionPayload, files: File[] = []): FormData {
  const body = new FormData();
  body.append('data', JSON.stringify(input));
  files.forEach((file) => body.append('images', file));
  return body;
}

/**
 * Why: Maps a backend `Submission`, `SellerProduct` or `SellerProductDetail` onto the field names the
 * seller pages render. `price` is the list price and `sellerPrice` is what the seller is paid.
 * @param item - A `Submission`, a `SellerProduct`, or a `SellerProductDetail`.
 * @returns The listing record: `id`, `kind` (`submission` or `product`), `status`,
 *   `rejectionReason`, `name`, `category` (label), `categoryKey`, `subcategory`, `description`,
 *   `condition`, `conditionLabel`, `brand`, `manufacturer`, `models`, `universalFit`, `size`,
 *   `comboSizes`, `quantity`, `price`, `sellerPrice`, `sellerPriceCents`, `markupPercent`, `serviceFeeWaived`,
 *   `images` (URLs), `imageItems` (`{id, url, thumbnailUrl}`), `thumbnails`, `primaryImage`,
 *   `primaryThumbnail`, `originalProductId`, `productId`, `pendingEditId`, `createdAt`,
 *   `createdAtMillis`, `updatedAt`.
 * @example
 * const row = toSellerListing(submission); // { id, status: 'pending', price: 540, sellerPrice: 450, ... }
 */
export function toSellerListing(item: ListingSource): SellerListing {
  const submission = 'listPriceCents' in item ? item : null;
  const product = submission ? null : (item as SellerProduct | SellerProductDetail);
  const detail = product && 'fitment' in product ? (product as SellerProductDetail) : null;
  const imageRefs: Array<ImageRef | Image> = 'images' in item ? item.images : [];
  const primaryImageUrl = product?.primaryImageUrl;
  const imageItems: SellerListingImage[] =
    imageRefs.length > 0
      ? imageRefs.map((image) => ({
          id: image.id,
          url: image.url,
          thumbnailUrl: image.thumbnailUrl || image.url,
        }))
      : primaryImageUrl
        ? [
            {
              id: undefined,
              url: primaryImageUrl,
              thumbnailUrl: product.primaryThumbnailUrl || primaryImageUrl,
            },
          ]
        : [];
  const images = imageItems.map((image) => image.url);
  const createdAt = (submission ? submission.createdAt : product?.listedAt) || null;
  const createdAtMillis = Date.parse(createdAt || '') || 0;

  return {
    id: item.id,
    kind: submission ? 'submission' : 'product',
    status: item.status,
    rejectionReason: submission?.rejectionReason || '',
    name: item.name,
    category: item.categoryLabel || CATEGORY_LABELS[item.category] || item.category,
    categoryKey: item.category,
    subcategory: item.subcategory || '',
    description: ('description' in item ? item.description : '') || '',
    condition: item.condition,
    conditionLabel: item.conditionLabel || '',
    brand: item.brand || '',
    manufacturer: submission?.manufacturer ?? detail?.fitment?.manufacturer ?? '',
    models: submission?.models ?? detail?.fitment?.models ?? [],
    universalFit: submission?.universalFit ?? detail?.fitment?.universal ?? false,
    size: ('size' in item ? item.size : null) || '',
    comboSizes: ('comboSizes' in item ? item.comboSizes : null) || null,
    quantity: item.quantity ?? detail?.quantityAvailable ?? 1,
    price: centsToRands(submission ? submission.listPriceCents : product?.effectivePriceCents),
    sellerPrice: centsToRands(item.sellerPriceCents),
    sellerPriceCents: item.sellerPriceCents,
    markupPercent: submission?.markupPercent ?? null,
    serviceFeeWaived: item.serviceFeeWaived === true,
    images,
    imageItems,
    thumbnails: imageItems.map((image) => image.thumbnailUrl),
    primaryImage: images[0] || null,
    primaryThumbnail: imageItems[0]?.thumbnailUrl || null,
    originalProductId: submission?.originalProductId || null,
    productId: submission ? submission.productId || null : item.id,
    pendingEditId: product?.pendingEditId || null,
    createdAt,
    createdAtMillis,
    updatedAt: submission?.updatedAt || null,
  };
}

/**
 * Why: Submits a new listing for admin review (`POST /me/submissions`).
 * @param args - Request parts.
 * @param args.input - The `SubmissionInput` from `toSubmissionInput()`.
 * @param args.files - 3-5 cropped images.
 * @returns The created listing (status `pending`).
 * @throws {ApiProblemError} 403 `SELLER_NOT_APPROVED`, 409 `TERMS_VERSION_OUTDATED`, 413, or 422
 *   with `errors[]` paths such as `data.brand` and `images.2`.
 * @example
 * const listing = await createSubmission({ input: toSubmissionInput(form), files });
 */
export async function createSubmission({ input, files }: ListingRequest): Promise<SellerListing> {
  return toSellerListing(
    await apiRequest<Submission>('/me/submissions', {
      method: 'POST',
      body: buildSubmissionFormData(input, files),
    }),
  );
}

/**
 * Why: The seller's own submissions (pending, approved and rejected) for the list and the
 * dashboard counts, with cursor pagination.
 * @param options - Query options.
 * @param options.status - `pending`, `approved` or `rejected`; omit for all.
 * @param options.cursor - `nextCursor` from the previous page.
 * @param options.limit - Page size.
 * @returns Listings and the next cursor.
 * @throws {ApiProblemError} On server errors.
 * @example
 * const { items, nextCursor } = await listMySubmissions({ status: 'pending', limit: 25 });
 */
export async function listMySubmissions({
  status,
  cursor,
  limit,
}: {
  status?: SubmissionStatus;
  cursor?: string | null;
  limit?: number;
} = {}): Promise<SellerListingPage> {
  const page = await apiRequest<SubmissionPage>('/me/submissions', {
    query: { status, cursor, limit },
  });
  return { items: page.items.map(toSellerListing), nextCursor: page.nextCursor };
}

/**
 * Why: Loads one submission, for example to refresh it after an edit.
 * @param id - Submission UUID.
 * @returns The listing.
 * @throws {ApiProblemError} 404 when it is not the caller's.
 * @example
 * const listing = await getMySubmission(id);
 */
export async function getMySubmission(id: string): Promise<SellerListing> {
  return toSellerListing(await apiRequest<Submission>(`/me/submissions/${encodeURIComponent(id)}`));
}

/**
 * Why: Edits a pending submission, or resubmits a rejected one (it becomes pending again).
 * @param id - Submission UUID.
 * @param args - Request parts.
 * @param args.input - The `SubmissionInput`, including `keepImageIds`.
 * @param args.files - New cropped images.
 * @returns The updated listing.
 * @throws {ApiProblemError} 409 `SUBMISSION_NOT_EDITABLE` (already approved) or 422.
 * @example
 * await updateSubmission(id, { input: toSubmissionInput(form, { keepImageIds }), files });
 */
export async function updateSubmission(
  id: string,
  { input, files }: ListingRequest,
): Promise<SellerListing> {
  return toSellerListing(
    await apiRequest<Submission>(`/me/submissions/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: buildSubmissionFormData(input, files),
    }),
  );
}

/**
 * Why: Deletes a submission that is still pending or rejected.
 * @param id - Submission UUID.
 * @throws {ApiProblemError} 409 `SUBMISSION_NOT_EDITABLE` or 404.
 * @example
 * await deleteSubmission(listing.id);
 */
export async function deleteSubmission(id: string): Promise<void> {
  await apiRequest<null>(`/me/submissions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/**
 * Why: The seller's own products (live, sold out) for the "my listings" table.
 * @param options - Query options.
 * @param options.cursor - `nextCursor` from the previous page.
 * @param options.limit - Page size.
 * @returns Listings and the next cursor.
 * @throws {ApiProblemError} On server errors.
 * @example
 * const { items } = await listMyProducts({ limit: 25 });
 */
export async function listMyProducts({
  cursor,
  limit,
}: { cursor?: string | null; limit?: number } = {}): Promise<SellerListingPage> {
  const page = await apiRequest<SellerProductPage>('/me/products', { query: { cursor, limit } });
  return { items: page.items.map(toSellerListing), nextCursor: page.nextCursor };
}

/**
 * Why: A `SellerProduct` row has no description, sizes, fitment or image ids, but the edit form
 * needs them. `GET /me/products/{id}` returns the full product plus the seller's own status,
 * quantity, price and pending edit, with image ids so existing photos can be kept (`keepImageIds`).
 * @param id - Product UUID.
 * @returns The listing with every editable field filled in.
 * @throws {ApiProblemError} 404 when it is not the caller's product.
 * @example
 * const editable = await fetchProductForEdit(listing.id);
 */
export async function fetchProductForEdit(id: string): Promise<SellerListing> {
  return toSellerListing(
    await apiRequest<SellerProductDetail>(`/me/products/${encodeURIComponent(id)}`),
  );
}

/**
 * Why: Edits a live product. The backend creates a pending submission and takes the product off
 * sale until an admin approves it.
 * @param productId - Product UUID.
 * @param args - Request parts.
 * @param args.input - The `SubmissionInput`, including `keepImageIds` (the product's image ids).
 * @param args.files - New cropped images.
 * @returns The new pending listing (with `originalProductId`).
 * @throws {ApiProblemError} 409 `LISTING_EDIT_PENDING` or `SUBMISSION_NOT_EDITABLE`, or 422.
 * @example
 * await editLiveProduct(product.id, { input: toSubmissionInput(form, { keepImageIds }), files });
 */
export async function editLiveProduct(
  productId: string,
  { input, files }: ListingRequest,
): Promise<SellerListing> {
  return toSellerListing(
    await apiRequest<Submission>(`/me/products/${encodeURIComponent(productId)}/edit`, {
      method: 'POST',
      body: buildSubmissionFormData(input, files),
    }),
  );
}

/**
 * Why: Takes one of the seller's products off the storefront (soft remove).
 * @param productId - Product UUID.
 * @throws {ApiProblemError} 404 when it is not the caller's.
 * @example
 * await removeMyProduct(listing.id);
 */
export async function removeMyProduct(productId: string): Promise<void> {
  await apiRequest<null>(`/me/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });
}

/**
 * Why: The live "buyers pay R..." preview. The backend owns the service fee rules, so the client
 * asks instead of calculating.
 * @param sellerPriceCents - The seller's price in integer cents.
 * @returns The quote.
 * @throws {ApiProblemError} 422 for an invalid price.
 * @example
 * const { listPriceCents, serviceFeeCents } = await fetchServiceFeeQuote(100000);
 */
export function fetchServiceFeeQuote(sellerPriceCents: number): Promise<ServiceFeeQuote> {
  return apiRequest<ServiceFeeQuote>('/pricing/service-fee-quote', { query: { sellerPriceCents } });
}
