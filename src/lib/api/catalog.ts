import { apiRequest, isApiProblem } from '@/lib/apiClient';
import type {
  AboutContent,
  CatalogConfig,
  Category,
  Faq,
  FaqList,
  ProductDetail,
  ProductList,
  ProductPage,
  ProductQuery,
  ProductSummary,
} from '@/lib/api/types';

/**
 * Why: Public catalog and content reads from the FastSport backend (`/v1/products*`,
 * `/v1/catalog/config`, `/v1/faqs`, `/v1/content/about`). Every product goes through
 * `toClientProduct()` so pages get one shape, with `price` taken from the backend.
 */

// Why: the backend uses lowercase category keys; the storefront URLs, filters and copy use these
// labels (`?category=Gear`). One map in both directions keeps them in sync.
export const CATEGORY_LABELS: Record<Category, string> = {
  gear: 'Gear',
  parts: 'Parts',
  accessories: 'Accessories',
};
const CATEGORY_KEYS: Record<string, Category> = Object.fromEntries(
  Object.entries(CATEGORY_LABELS).map(([key, label]) => [label.toLowerCase(), key as Category]),
);

/** A product as the storefront pages and cart use it: a backend product plus derived fields. */
export type ClientProduct = Omit<ProductSummary, 'category' | 'specialLabel'> &
  Partial<Omit<ProductDetail, keyof ProductSummary | 'images'>> & {
    /** Display label (`Gear`), not the backend key. */
    category: string;
    /** Backend category key (`gear`). */
    categoryKey: Category;
    /** Full-size image URLs. */
    images: string[];
    primaryImage: string | null;
    /** 480x360 thumbnail, falling back to the full image. */
    primaryThumbnail: string | null;
    thumbnails: string[];
    /** All-in price in rands (special applied). */
    price: number;
    /** Per-unit service fee in rands. */
    serviceFee: number;
    /** Listed price in rands. */
    basePrice: number;
    originalPrice: number | null;
    /** Badge text while a special is active, else ''. */
    specialLabel: string;
    quantity: number | undefined;
    gearCondition: string;
    gearBrand: string;
    gearSize: string;
    sellerSuburb: string;
    sellerCity: string;
    createdAt: string;
  };

/** Filters accepted by `fetchProducts`: the backend query, with rands and label-friendly values. */
export type ProductFilters = Omit<
  ProductQuery,
  'category' | 'brand' | 'condition' | 'minPriceCents' | 'maxPriceCents'
> & {
  /** Category label or key. */
  category?: string | null;
  brand?: string | string[];
  condition?: string | string[];
  /** Minimum effective price in rands. */
  minPrice?: number | null;
  /** Maximum effective price in rands. */
  maxPrice?: number | null;
};

/** One page of client products. */
export interface ClientProductPage {
  items: ClientProduct[];
  nextCursor: ProductPage['nextCursor'];
}

/** Options shared by the popular and new product carousels. */
interface ProductListOptions {
  /** Category label or key. */
  category?: string | null;
  limit?: number;
}

/**
 * Why: Accepts either form a page might pass (`'Gear'`, `'gear'`) and returns the backend key.
 * @param category - Category label or key.
 * @returns Backend key (`gear`, `parts`, `accessories`), or undefined.
 * @example
 * toCategoryKey('Gear'); // 'gear'
 */
export function toCategoryKey(category: string | null | undefined): Category | undefined {
  if (!category) return undefined;
  const lower = String(category).toLowerCase();
  return lower in CATEGORY_LABELS ? (lower as Category) : CATEGORY_KEYS[lower];
}

/**
 * Why: Converts integer cents from the API to the rand amounts the pages format today.
 * @param cents - Amount in cents.
 * @returns Amount in rands (0 when missing).
 * @example
 * centsToRands(129950); // 1299.5
 */
export function centsToRands(cents: number | null | undefined): number {
  return typeof cents === 'number' && Number.isFinite(cents) ? cents / 100 : 0;
}

/**
 * Why: Converts a rand amount typed by a user into the integer cents the API takes, rounding so
 * floating point artefacts such as `19.99 * 100` never produce fractional cents.
 * @param rands - Amount in rands.
 * @returns Whole cents (NaN when the value is not a number).
 * @example
 * randsToCents('450.50'); // 45050
 */
export function randsToCents(rands: string | number | null | undefined): number {
  if (rands === '' || rands === null || rands === undefined) return NaN;
  return Math.round(Number(rands) * 100);
}

/**
 * Why: Listings show the all-in price, so the buyer is told how much of it is the FastSport
 * service fee; one formatter keeps that wording identical on every page.
 * @param serviceFee - Per-unit service fee in rands.
 * @returns The label, or '' when the fee is zero, negative or missing.
 * @example
 * formatServiceFeeLabel(110); // 'incl. R110.00 service fee'
 */
export function formatServiceFeeLabel(serviceFee: number | string | null | undefined): string {
  return Number(serviceFee) > 0 ? `incl. R${Number(serviceFee).toFixed(2)} service fee` : '';
}

// Why: Shown on a seller's fee-free listing, so every seller screen words it the same way.
export const SERVICE_FEE_WAIVED_LABEL = 'FastSport service fee waived';

/**
 * Why: Readable fallback for an enum key (e.g. `new_in_packaging` -> `New in packaging`) when
 * the API response has no display label for it.
 * @param key - The enum key.
 * @returns The humanized text, or '' when missing.
 * @example
 * humanizeKey('used_good'); // 'Used good'
 */
function humanizeKey(key: string | null | undefined): string {
  if (!key) return '';
  const text = String(key).replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Why: Maps a backend `ProductSummary`/`ProductDetail` onto the product shape the storefront
 * pages and cart already use, so the page code doesn't change field by field. Pricing comes
 * straight from the backend (checkout charges `effectivePriceCents`).
 * @param product - A `ProductSummary` or `ProductDetail` from the API.
 * @returns The client product record.
 * @example
 * const card = toClientProduct(summary); // { id, name, price, originalPrice, primaryImage, ... }
 */
export function toClientProduct(product: ProductSummary | ProductDetail): ClientProduct {
  const detail = 'images' in product ? product : null;
  const images =
    detail && detail.images.length > 0
      ? detail.images.map((image) => image.url)
      : product.primaryImageUrl
        ? [product.primaryImageUrl]
        : [];
  const primaryImage = product.primaryImageUrl || images[0] || null;
  const price = centsToRands(product.effectivePriceCents);
  const basePrice = centsToRands(product.basePriceCents);
  const serviceFee = centsToRands(product.serviceFeeCents);

  return {
    ...product,
    category: product.categoryLabel || CATEGORY_LABELS[product.category] || product.category,
    categoryKey: product.category,
    images,
    primaryImage,
    // Why: cards, carousels, cart and search show the 480x360 thumbnail, falling back to the full image.
    primaryThumbnail: product.primaryThumbnailUrl || primaryImage,
    thumbnails:
      detail && detail.images.length > 0
        ? detail.images.map((image) => image.thumbnailUrl || image.url)
        : images,
    price,
    serviceFee,
    basePrice,
    originalPrice: product.isSpecialActive ? basePrice : null,
    specialLabel: product.isSpecialActive ? product.specialLabel || 'Special' : '',
    quantity: detail?.quantityAvailable,
    // Why: the product page's gear spec list reads these legacy field names.
    gearCondition: product.conditionLabel || humanizeKey(product.condition),
    gearBrand: product.brand || '',
    gearSize: detail?.comboSizes
      ? `Shirt ${detail.comboSizes.shirt} / Pants ${detail.comboSizes.pants}`
      : detail?.size || '',
    sellerSuburb: product.seller?.suburb || '',
    sellerCity: product.seller?.city || '',
    createdAt: product.listedAt,
  };
}

/**
 * Why: One page of live products with server-side search, filters and sorting.
 * @param filters - Query filters; see `GET /v1/products` in the OpenAPI contract.
 * @param filters.q - Free-text search.
 * @param filters.category - Category label or key.
 * @param filters.subcategory - Subcategory (gear item for gear).
 * @param filters.brand - One or more brands (any match).
 * @param filters.condition - One or more condition keys.
 * @param filters.manufacturer - Bike manufacturer (parts fitment).
 * @param filters.model - Bike model (parts fitment).
 * @param filters.minPrice - Minimum effective price in rands.
 * @param filters.maxPrice - Maximum effective price in rands.
 * @param filters.sort - `relevance` | `newest` | `popular` | `price_asc` | `price_desc`.
 * @param filters.cursor - `nextCursor` from the previous page.
 * @param filters.limit - Page size (1–100, default 24).
 * @returns Client product records.
 * @throws {ApiProblemError} 422 `VALIDATION_FAILED` on bad filters.
 * @example
 * const { items, nextCursor } = await fetchProducts({ category: 'Gear', sort: 'newest' });
 */
export async function fetchProducts(filters: ProductFilters = {}): Promise<ClientProductPage> {
  const { minPrice, maxPrice, condition, brand, category, ...rest } = filters;
  const page = await apiRequest<ProductPage>('/products', {
    query: {
      ...rest,
      category: toCategoryKey(category),
      condition: Array.isArray(condition) ? condition.join(',') : condition,
      brand: Array.isArray(brand) ? brand.join(',') : brand,
      minPriceCents:
        typeof minPrice === 'number' && Number.isFinite(minPrice)
          ? Math.round(minPrice * 100)
          : undefined,
      maxPriceCents:
        typeof maxPrice === 'number' && Number.isFinite(maxPrice)
          ? Math.round(maxPrice * 100)
          : undefined,
    },
  });
  return { items: page.items.map(toClientProduct), nextCursor: page.nextCursor };
}

/**
 * Why: "Popular this week" carousel, ranked by the backend's 7-day view counts.
 * @param options - Options.
 * @param options.category - Optional category label or key.
 * @param options.limit - Maximum items.
 * @returns Client product records.
 * @throws {ApiProblemError} On server errors.
 * @example
 * const popular = await fetchPopularProducts({ limit: 6 });
 */
export async function fetchPopularProducts({ category, limit }: ProductListOptions = {}): Promise<
  ClientProduct[]
> {
  const list = await apiRequest<ProductList>('/products/popular', {
    query: { category: toCategoryKey(category), limit },
  });
  return list.items.map(toClientProduct);
}

/**
 * Why: "New this week" carousels (listed in the last 7 days), optionally per category.
 * @param options - Options.
 * @param options.category - Optional category label or key.
 * @param options.limit - Maximum items.
 * @returns Client product records.
 * @throws {ApiProblemError} On server errors.
 * @example
 * const newGear = await fetchNewProducts({ category: 'Gear', limit: 6 });
 */
export async function fetchNewProducts({ category, limit }: ProductListOptions = {}): Promise<
  ClientProduct[]
> {
  const list = await apiRequest<ProductList>('/products/new', {
    query: { category: toCategoryKey(category), limit },
  });
  return list.items.map(toClientProduct);
}

/**
 * Why: Product detail page and checkout re-validation.
 * @param productId - Product UUID.
 * @returns The client product record, or `null` when not found.
 * @throws {ApiProblemError} On errors other than 404.
 * @example
 * const product = await fetchProductById(router.query.id);
 */
export async function fetchProductById(
  productId: string | null | undefined,
): Promise<ClientProduct | null> {
  if (!productId) return null;
  try {
    return toClientProduct(
      await apiRequest<ProductDetail>(`/products/${encodeURIComponent(productId)}`),
    );
  } catch (err) {
    if (isApiProblem(err, 404)) {
      return null;
    }
    throw err;
  }
}

/**
 * Why: Counts a product view for "popular" rankings. Best-effort: a failure must never break the
 * product page, so errors are swallowed here (the backend rate-limits and dedupes).
 * @param productId - Product UUID.
 * @example
 * recordProductView(product.id);
 */
export async function recordProductView(productId: string): Promise<void> {
  try {
    await apiRequest<unknown>(`/products/${encodeURIComponent(productId)}/views`, {
      method: 'POST',
    });
  } catch {
    // Intentionally ignored: view counting is best-effort.
  }
}

/**
 * Why: Category, condition, brand, fitment and size options for filters and the seller form.
 * @returns The backend `CatalogConfig`.
 * @throws {ApiProblemError} On server errors.
 * @example
 * const config = await fetchCatalogConfig();
 */
export function fetchCatalogConfig(): Promise<CatalogConfig> {
  return apiRequest<CatalogConfig>('/catalog/config');
}

/**
 * Why: Public FAQ page, ordered as the admin arranged them.
 * @throws {ApiProblemError} On server errors.
 * @example
 * const faqs = await fetchFaqs();
 */
export async function fetchFaqs(): Promise<Faq[]> {
  const list = await apiRequest<FaqList>('/faqs');
  return [...list.items].sort((a, b) => a.position - b.position);
}

/**
 * Why: Public About page content (plain text; only `**bold**` is interpreted when rendering).
 * @throws {ApiProblemError} On server errors.
 * @example
 * const about = await fetchAboutContent();
 */
export function fetchAboutContent(): Promise<AboutContent> {
  return apiRequest<AboutContent>('/content/about');
}
