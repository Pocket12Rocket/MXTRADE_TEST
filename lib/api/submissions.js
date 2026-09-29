import { apiRequest } from '../apiClient';
import { CATEGORY_LABELS, centsToRands, randsToCents } from './catalog';
import {
  OTHER_BRAND_VALUE,
  OTHER_MANUFACTURER,
  OTHER_SUBCATEGORY_VALUE,
  UNIVERSAL_MANUFACTURER,
  parseModelInput,
  resolveOther,
} from '../listingForm';

/**
 * Why: Seller listing calls (`/v1/me/submissions*`, `/v1/me/products*`, `/v1/pricing/markup-quote`),
 * replacing the Firestore `submissions`/`products` reads and writes and the Firebase Storage
 * uploads in the seller pages. Listings are created and edited as multipart requests: a `data`
 * field with the JSON `SubmissionInput` plus the cropped photos under `images` (3-5 in total,
 * counting kept images, D-13). The backend applies the markup (D-04), so the client only sends the
 * seller's own price in cents and shows the buyer price from `fetchMarkupQuote()`.
 */

/**
 * Why: Turns the seller form's state into the `SubmissionInput` the backend expects. Both seller
 * pages build their request through this one function, so the create and edit flows can never
 * drift apart. Prices go over the API as integer cents.
 * @param {object} form - Form state from `lib/listingForm.js` (`emptyListingForm`/`formFromListing`).
 * @param {object} [options] - Options.
 * @param {string[]} [options.keepImageIds] - Existing image ids to keep, in order; pass it on
 *   edits only (omit for a new submission).
 * @returns {object} The `SubmissionInput` (see the contract, section 1).
 * @example
 * const input = toSubmissionInput(form, { keepImageIds: ['img-1', 'img-2'] });
 */
export function toSubmissionInput(form, { keepImageIds } = {}) {
  const isGear = form.category === 'gear';
  const isParts = form.category === 'parts';
  const isUniversal = isParts && form.manufacturer === UNIVERSAL_MANUFACTURER;
  const comboSizes = isGear && form.comboShirt && form.comboPants
    ? { shirt: form.comboShirt, pants: form.comboPants }
    : null;

  const manufacturer = isParts && !isUniversal
    ? resolveOther(form.manufacturer, form.otherManufacturer, OTHER_MANUFACTURER)
    : '';
  const models = isParts && !isUniversal
    ? Array.from(new Set([...form.models.map((model) => model.trim()).filter(Boolean), ...parseModelInput(form.customModels)]))
    : [];

  const input = {
    category: form.category,
    subcategory: resolveOther(form.subcategory, form.customSubcategory, OTHER_SUBCATEGORY_VALUE),
    // Why: the backend names gear and accessories "<brand> <subcategory>" itself; only parts have a typed name.
    name: isParts ? form.name.trim() : null,
    description: form.description.trim(),
    condition: form.condition,
    brand: resolveOther(form.brand, form.customBrand, OTHER_BRAND_VALUE) || null,
    manufacturer: manufacturer || null,
    models,
    universalFit: isUniversal,
    size: isGear && !comboSizes ? (form.size.trim() || null) : null,
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
 * @param {object} input - The `SubmissionInput`.
 * @param {File[]} [files] - New (already cropped) images, in display order.
 * @returns {FormData} `data` (the JSON input) plus one `images` part per file.
 * @example
 * const body = buildSubmissionFormData(input, croppedFiles);
 */
export function buildSubmissionFormData(input, files = []) {
  const body = new FormData();
  body.append('data', JSON.stringify(input));
  files.forEach((file) => body.append('images', file));
  return body;
}

/**
 * Why: Maps a backend `Submission`, `SellerProduct` or `SellerProductDetail` onto the field names the
 * seller pages render (price in rands, image URLs, thumbnails, category label), the same approach
 * as `toClientProduct()`. Nothing is computed: `price` is the backend's list price and
 * `sellerPrice` is what the seller is paid.
 * @param {object} item - A `Submission`, a `SellerProduct`, or a `SellerProductDetail`.
 * @returns {object} The listing record: `id`, `kind` (`submission` or `product`), `status`,
 *   `rejectionReason`, `name`, `category` (label), `categoryKey`, `subcategory`, `description`,
 *   `condition`, `conditionLabel`, `brand`, `manufacturer`, `models`, `universalFit`, `size`,
 *   `comboSizes`, `quantity`, `price`, `sellerPrice`, `sellerPriceCents`, `markupPercent`,
 *   `images` (URLs), `imageItems` (`{id, url, thumbnailUrl}`), `thumbnails`, `primaryImage`,
 *   `primaryThumbnail`, `originalProductId`, `productId`, `pendingEditId`, `createdAt`,
 *   `createdAtMillis`, `updatedAt`.
 * @example
 * const row = toSellerListing(submission); // { id, status: 'pending', price: 540, sellerPrice: 450, ... }
 */
export function toSellerListing(item) {
  const isSubmission = item.listPriceCents !== undefined;
  const imageItems = Array.isArray(item.images) && item.images.length > 0
    ? item.images.map((image) => ({ id: image.id, url: image.url, thumbnailUrl: image.thumbnailUrl || image.url }))
    : (item.primaryImageUrl ? [{ id: undefined, url: item.primaryImageUrl, thumbnailUrl: item.primaryThumbnailUrl || item.primaryImageUrl }] : []);
  const images = imageItems.map((image) => image.url);
  const createdAtMillis = Date.parse(item.createdAt || item.listedAt || '') || 0;

  return {
    id: item.id,
    kind: isSubmission ? 'submission' : 'product',
    status: item.status,
    rejectionReason: item.rejectionReason || '',
    name: item.name,
    category: item.categoryLabel || CATEGORY_LABELS[item.category] || item.category,
    categoryKey: item.category,
    subcategory: item.subcategory || '',
    description: item.description || '',
    condition: item.condition,
    conditionLabel: item.conditionLabel || '',
    brand: item.brand || '',
    manufacturer: item.manufacturer ?? item.fitment?.manufacturer ?? '',
    models: item.models ?? item.fitment?.models ?? [],
    universalFit: item.universalFit ?? item.fitment?.universal ?? false,
    size: item.size || '',
    comboSizes: item.comboSizes || null,
    quantity: item.quantity ?? item.quantityAvailable ?? 1,
    price: centsToRands(item.listPriceCents ?? item.effectivePriceCents),
    sellerPrice: centsToRands(item.sellerPriceCents),
    sellerPriceCents: item.sellerPriceCents,
    markupPercent: item.markupPercent ?? null,
    images,
    imageItems,
    thumbnails: imageItems.map((image) => image.thumbnailUrl),
    primaryImage: images[0] || null,
    primaryThumbnail: imageItems[0]?.thumbnailUrl || null,
    originalProductId: item.originalProductId || null,
    productId: item.productId || (isSubmission ? null : item.id),
    pendingEditId: item.pendingEditId || null,
    createdAt: item.createdAt || item.listedAt || null,
    createdAtMillis,
    updatedAt: item.updatedAt || null,
  };
}

/**
 * Why: Submits a new listing for admin review (`POST /me/submissions`).
 * @param {object} args - Request parts.
 * @param {object} args.input - The `SubmissionInput` from `toSubmissionInput()`.
 * @param {File[]} args.files - 3-5 cropped images.
 * @returns {Promise<object>} The created listing (status `pending`).
 * @throws {ApiProblemError} 403 `SELLER_NOT_APPROVED`, 409 `TERMS_VERSION_OUTDATED`, 413, or 422
 *   with `errors[]` paths such as `data.brand` and `images.2`.
 * @example
 * const listing = await createSubmission({ input: toSubmissionInput(form), files });
 */
export async function createSubmission({ input, files }) {
  return toSellerListing(await apiRequest('/me/submissions', { method: 'POST', body: buildSubmissionFormData(input, files) }));
}

/**
 * Why: The seller's own submissions (pending, approved and rejected) for the list and the
 * dashboard counts, with cursor pagination.
 * @param {object} [options] - Query options.
 * @param {string} [options.status] - `pending`, `approved` or `rejected`; omit for all.
 * @param {string} [options.cursor] - `nextCursor` from the previous page.
 * @param {number} [options.limit] - Page size.
 * @returns {Promise<{items: object[], nextCursor: string|null}>} Listings and the next cursor.
 * @throws {ApiProblemError} On server errors.
 * @example
 * const { items, nextCursor } = await listMySubmissions({ status: 'pending', limit: 25 });
 */
export async function listMySubmissions({ status, cursor, limit } = {}) {
  const page = await apiRequest('/me/submissions', { query: { status, cursor, limit } });
  return { items: page.items.map(toSellerListing), nextCursor: page.nextCursor };
}

/**
 * Why: Loads one submission, for example to refresh it after an edit.
 * @param {string} id - Submission UUID.
 * @returns {Promise<object>} The listing.
 * @throws {ApiProblemError} 404 when it is not the caller's.
 * @example
 * const listing = await getMySubmission(id);
 */
export async function getMySubmission(id) {
  return toSellerListing(await apiRequest(`/me/submissions/${encodeURIComponent(id)}`));
}

/**
 * Why: Edits a pending submission, or resubmits a rejected one (it becomes pending again).
 * @param {string} id - Submission UUID.
 * @param {object} args - Request parts.
 * @param {object} args.input - The `SubmissionInput`, including `keepImageIds`.
 * @param {File[]} args.files - New cropped images.
 * @returns {Promise<object>} The updated listing.
 * @throws {ApiProblemError} 409 `SUBMISSION_NOT_EDITABLE` (already approved) or 422.
 * @example
 * await updateSubmission(id, { input: toSubmissionInput(form, { keepImageIds }), files });
 */
export async function updateSubmission(id, { input, files }) {
  return toSellerListing(await apiRequest(`/me/submissions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: buildSubmissionFormData(input, files),
  }));
}

/**
 * Why: Deletes a submission that is still pending or rejected.
 * @param {string} id - Submission UUID.
 * @returns {Promise<void>}
 * @throws {ApiProblemError} 409 `SUBMISSION_NOT_EDITABLE` or 404.
 * @example
 * await deleteSubmission(listing.id);
 */
export async function deleteSubmission(id) {
  await apiRequest(`/me/submissions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/**
 * Why: The seller's own products (live, sold out) for the "my listings" table.
 * @param {object} [options] - Query options.
 * @param {string} [options.cursor] - `nextCursor` from the previous page.
 * @param {number} [options.limit] - Page size.
 * @returns {Promise<{items: object[], nextCursor: string|null}>} Listings and the next cursor.
 * @throws {ApiProblemError} On server errors.
 * @example
 * const { items } = await listMyProducts({ limit: 25 });
 */
export async function listMyProducts({ cursor, limit } = {}) {
  const page = await apiRequest('/me/products', { query: { cursor, limit } });
  return { items: page.items.map(toSellerListing), nextCursor: page.nextCursor };
}

/**
 * Why: A `SellerProduct` row has no description, sizes, fitment or image ids, but the edit form
 * needs them. `GET /me/products/{id}` returns the full product plus the seller's own status,
 * quantity, price and pending edit, with image ids so existing photos can be kept (`keepImageIds`).
 * @param {string} id - Product UUID.
 * @returns {Promise<object>} The listing with every editable field filled in.
 * @throws {ApiProblemError} 404 when it is not the caller's product.
 * @example
 * const editable = await fetchProductForEdit(listing.id);
 */
export async function fetchProductForEdit(id) {
  return toSellerListing(await apiRequest(`/me/products/${encodeURIComponent(id)}`));
}

/**
 * Why: Edits a live product. The backend creates a pending submission and takes the product off
 * sale until an admin approves it (D-12).
 * @param {string} productId - Product UUID.
 * @param {object} args - Request parts.
 * @param {object} args.input - The `SubmissionInput`, including `keepImageIds` (the product's image ids).
 * @param {File[]} args.files - New cropped images.
 * @returns {Promise<object>} The new pending listing (with `originalProductId`).
 * @throws {ApiProblemError} 409 `LISTING_EDIT_PENDING` or `SUBMISSION_NOT_EDITABLE`, or 422.
 * @example
 * await editLiveProduct(product.id, { input: toSubmissionInput(form, { keepImageIds }), files });
 */
export async function editLiveProduct(productId, { input, files }) {
  return toSellerListing(await apiRequest(`/me/products/${encodeURIComponent(productId)}/edit`, {
    method: 'POST',
    body: buildSubmissionFormData(input, files),
  }));
}

/**
 * Why: Takes one of the seller's products off the storefront (soft remove).
 * @param {string} productId - Product UUID.
 * @returns {Promise<void>}
 * @throws {ApiProblemError} 404 when it is not the caller's.
 * @example
 * await removeMyProduct(listing.id);
 */
export async function removeMyProduct(productId) {
  await apiRequest(`/me/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });
}

/**
 * Why: The live "buyers pay R..." preview. The backend owns the markup rules (D-04), so the client
 * asks instead of calculating.
 * @param {number} sellerPriceCents - The seller's price in integer cents.
 * @returns {Promise<{sellerPriceCents: number, listPriceCents: number, markupPercent: number}>}
 *   The quote.
 * @throws {ApiProblemError} 422 for an invalid price.
 * @example
 * const { listPriceCents } = await fetchMarkupQuote(45000);
 */
export function fetchMarkupQuote(sellerPriceCents) {
  return apiRequest('/pricing/markup-quote', { query: { sellerPriceCents } });
}
