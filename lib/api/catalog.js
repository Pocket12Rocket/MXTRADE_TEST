import { apiRequest } from '../apiClient';

/**
 * Why: Public catalog and content reads from the FastSport backend (`/v1/products*`,
 * `/v1/catalog/config`, `/v1/faqs`, `/v1/content/about`), replacing the Firestore reads and the
 * IndexedDB versioned cache (the backend sends `Cache-Control`/`ETag` instead). Every product is
 * passed through `toClientProduct()` so pages keep using the field names they already render
 * (`price` in rands, `primaryImage`, `images[]` URLs, `category` label) while the backend stays
 * authoritative for pricing: `price` is the backend's `effectivePriceCents`, never recomputed here.
 */

// Why: the backend uses lowercase category keys; the storefront URLs, filters and copy use these
// labels (`?category=Gear`). One map in both directions keeps them in sync.
export const CATEGORY_LABELS = { gear: 'Gear', parts: 'Parts', accessories: 'Accessories' };
const CATEGORY_KEYS = Object.fromEntries(Object.entries(CATEGORY_LABELS).map(([key, label]) => [label.toLowerCase(), key]));

/**
 * Why: Accepts either form a page might pass (`'Gear'`, `'gear'`) and returns the backend key.
 * @param {string} [category] - Category label or key.
 * @returns {string|undefined} Backend key (`gear`, `parts`, `accessories`), or undefined.
 * @example
 * toCategoryKey('Gear'); // 'gear'
 */
export function toCategoryKey(category) {
  if (!category) return undefined;
  const lower = String(category).toLowerCase();
  return CATEGORY_LABELS[lower] ? lower : CATEGORY_KEYS[lower];
}

/**
 * Why: Converts integer cents from the API to the rand amounts the pages format today.
 * @param {number|null|undefined} cents - Amount in cents.
 * @returns {number} Amount in rands (0 when missing).
 * @example
 * centsToRands(129950); // 1299.5
 */
export function centsToRands(cents) {
  return Number.isFinite(cents) ? cents / 100 : 0;
}

/**
 * Why: Readable fallback for an enum key (e.g. `new_in_packaging` -> `New in packaging`) when
 * the API response has no display label for it.
 * @param {string|null|undefined} key - The enum key.
 * @returns {string} The humanized text, or '' when missing.
 * @example
 * humanizeKey('used_good'); // 'Used good'
 */
function humanizeKey(key) {
  if (!key) return '';
  const text = String(key).replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Why: Maps a backend `ProductSummary`/`ProductDetail` onto the product shape the storefront
 * pages and cart already use, so the page code doesn't change field by field. Pricing comes
 * straight from the backend (checkout charges `effectivePriceCents`).
 * @param {object} product - A `ProductSummary` or `ProductDetail` from the API.
 * @returns {object} The client product record.
 * @example
 * const card = toClientProduct(summary); // { id, name, price, originalPrice, primaryImage, ... }
 */
export function toClientProduct(product) {
  const images = Array.isArray(product.images) && product.images.length > 0
    ? product.images.map((image) => image.url)
    : (product.primaryImageUrl ? [product.primaryImageUrl] : []);
  const price = centsToRands(product.effectivePriceCents);
  const basePrice = centsToRands(product.basePriceCents);

  return {
    ...product,
    category: CATEGORY_LABELS[product.category] || product.category,
    categoryKey: product.category,
    images,
    primaryImage: product.primaryImageUrl || images[0] || null,
    price,
    basePrice,
    originalPrice: product.isSpecialActive ? basePrice : null,
    specialLabel: product.isSpecialActive ? (product.specialLabel || 'Special') : '',
    quantity: product.quantityAvailable,
    // Why: the product page's gear spec list reads these legacy field names.
    gearCondition: product.conditionLabel || humanizeKey(product.condition),
    gearBrand: product.brand || '',
    gearSize: product.comboSizes
      ? `Shirt ${product.comboSizes.shirt} / Pants ${product.comboSizes.pants}`
      : (product.size || ''),
    sellerSuburb: product.seller?.suburb || '',
    sellerCity: product.seller?.city || '',
    createdAt: product.listedAt,
  };
}

/**
 * Why: One page of live products with server-side search, filters and sorting (replaces
 * downloading the whole catalog and filtering in the browser).
 * @param {object} [filters] - Query filters; see `GET /v1/products` in the OpenAPI contract.
 * @param {string} [filters.q] - Free-text search.
 * @param {string} [filters.category] - Category label or key.
 * @param {string} [filters.subcategory] - Subcategory (gear item for gear).
 * @param {string} [filters.brand] - Brand.
 * @param {string|string[]} [filters.condition] - One or more condition keys.
 * @param {string} [filters.manufacturer] - Bike manufacturer (parts fitment).
 * @param {string} [filters.model] - Bike model (parts fitment).
 * @param {number} [filters.minPrice] - Minimum effective price in rands.
 * @param {number} [filters.maxPrice] - Maximum effective price in rands.
 * @param {string} [filters.sort] - `relevance` | `newest` | `popular` | `price_asc` | `price_desc`.
 * @param {string} [filters.cursor] - `nextCursor` from the previous page.
 * @param {number} [filters.limit] - Page size (1–100, default 24).
 * @returns {Promise<{items: object[], nextCursor: string|null}>} Client product records.
 * @throws {ApiProblemError} 422 `VALIDATION_FAILED` on bad filters.
 * @example
 * const { items, nextCursor } = await fetchProducts({ category: 'Gear', sort: 'newest' });
 */
export async function fetchProducts(filters = {}) {
  const { minPrice, maxPrice, condition, category, ...rest } = filters;
  const page = await apiRequest('/products', {
    query: {
      ...rest,
      category: toCategoryKey(category),
      condition: Array.isArray(condition) ? condition.join(',') : condition,
      minPriceCents: Number.isFinite(minPrice) ? Math.round(minPrice * 100) : undefined,
      maxPriceCents: Number.isFinite(maxPrice) ? Math.round(maxPrice * 100) : undefined,
    },
  });
  return { items: page.items.map(toClientProduct), nextCursor: page.nextCursor };
}

/**
 * Why: "Popular this week" carousel, ranked by the backend's 7-day view counts.
 * @param {object} [options] - Options.
 * @param {string} [options.category] - Optional category label or key.
 * @param {number} [options.limit] - Maximum items.
 * @returns {Promise<object[]>} Client product records.
 * @throws {ApiProblemError} On server errors.
 * @example
 * const popular = await fetchPopularProducts({ limit: 6 });
 */
export async function fetchPopularProducts({ category, limit } = {}) {
  const list = await apiRequest('/products/popular', { query: { category: toCategoryKey(category), limit } });
  return list.items.map(toClientProduct);
}

/**
 * Why: "New this week" carousels (listed in the last 7 days), optionally per category.
 * @param {object} [options] - Options.
 * @param {string} [options.category] - Optional category label or key.
 * @param {number} [options.limit] - Maximum items.
 * @returns {Promise<object[]>} Client product records.
 * @throws {ApiProblemError} On server errors.
 * @example
 * const newGear = await fetchNewProducts({ category: 'Gear', limit: 6 });
 */
export async function fetchNewProducts({ category, limit } = {}) {
  const list = await apiRequest('/products/new', { query: { category: toCategoryKey(category), limit } });
  return list.items.map(toClientProduct);
}

/**
 * Why: Product detail page and checkout re-validation.
 * @param {string} productId - Product UUID.
 * @returns {Promise<object|null>} The client product record, or `null` when not found.
 * @throws {ApiProblemError} On errors other than 404.
 * @example
 * const product = await fetchProductById(router.query.id);
 */
export async function fetchProductById(productId) {
  if (!productId) return null;
  try {
    return toClientProduct(await apiRequest(`/products/${encodeURIComponent(productId)}`));
  } catch (err) {
    if (err?.name === 'ApiProblemError' && err.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Why: Counts a product view for "popular" rankings. Best-effort: a failure must never break the
 * product page, so errors are swallowed here (the backend rate-limits and dedupes).
 * @param {string} productId - Product UUID.
 * @returns {Promise<void>}
 * @example
 * recordProductView(product.id);
 */
export async function recordProductView(productId) {
  try {
    await apiRequest(`/products/${encodeURIComponent(productId)}/views`, { method: 'POST' });
  } catch {
    // Intentionally ignored: view counting is best-effort.
  }
}

/**
 * Why: Category, condition, brand, fitment and size options for filters and the seller form.
 * @returns {Promise<object>} The backend `CatalogConfig`.
 * @throws {ApiProblemError} On server errors.
 * @example
 * const config = await fetchCatalogConfig();
 */
export function fetchCatalogConfig() {
  return apiRequest('/catalog/config');
}

/**
 * Why: Public FAQ page, ordered as the admin arranged them.
 * @returns {Promise<Array<{id: string, question: string, answer: string, position: number}>>}
 * @throws {ApiProblemError} On server errors.
 * @example
 * const faqs = await fetchFaqs();
 */
export async function fetchFaqs() {
  const list = await apiRequest('/faqs');
  return [...list.items].sort((a, b) => a.position - b.position);
}

/**
 * Why: Public About page content (plain text; only `**bold**` is interpreted when rendering).
 * @returns {Promise<{aboutUsBody: string, howItWorksBody: string, updatedAt: string|null}>}
 * @throws {ApiProblemError} On server errors.
 * @example
 * const about = await fetchAboutContent();
 */
export function fetchAboutContent() {
  return apiRequest('/content/about');
}
