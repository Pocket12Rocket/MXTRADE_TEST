import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchFaqs,
  fetchProductById,
  fetchProducts,
  recordProductView,
  toCategoryKey,
  formatServiceFeeLabel,
  toClientProduct,
} from './catalog';
import { callOf, type FetchImpl } from '@/test/fetch';
import type { ProductDetail, ProductSummary } from './types';

const summary: ProductSummary = {
  id: 'p1',
  name: 'Fox helmet',
  category: 'gear',
  // Why: empty labels exercise the client-side fallbacks for category and condition.
  categoryLabel: '',
  subcategory: 'Helmet',
  condition: 'lightly_used',
  conditionLabel: '',
  brand: 'Fox',
  primaryImageUrl: 'http://localhost:4000/files/p1.webp',
  primaryThumbnailUrl: null,
  basePriceCents: 150000,
  effectivePriceCents: 120000,
  serviceFeeCents: 11000,
  isSpecialActive: true,
  specialLabel: 'Winter sale',
  seller: { suburb: 'Sea Point', city: 'Cape Town' },
  listedAt: '2026-09-20T10:00:00Z',
};

const detailFields: Omit<ProductDetail, keyof ProductSummary> = {
  status: 'listed',
  description: '',
  specifications: [],
  images: [],
  quantityAvailable: 1,
  size: null,
  comboSizes: null,
  fitment: null,
  special: null,
};

/**
 * Why: Stubs fetch with one JSON response and returns the mock for URL assertions.
 * @param body - JSON body to return.
 * @param status - HTTP status.
 * @returns The fetch mock.
 */
function stubJson(body: unknown, status = 200) {
  const fetchMock = vi.fn<FetchImpl>(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          'content-type': status >= 400 ? 'application/problem+json' : 'application/json',
        },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toClientProduct', () => {
  it('maps cents, labels, images and seller fields to the page shape', () => {
    const product = toClientProduct(summary);

    expect(product).toMatchObject({
      category: 'Gear',
      categoryKey: 'gear',
      price: 1200,
      basePrice: 1500,
      serviceFee: 110,
      originalPrice: 1500,
      specialLabel: 'Winter sale',
      primaryImage: summary.primaryImageUrl,
      images: [summary.primaryImageUrl],
      sellerSuburb: 'Sea Point',
      sellerCity: 'Cape Town',
      gearCondition: 'Lightly used',
      gearBrand: 'Fox',
    });
  });

  it('uses detail images and combo sizes when present, and no original price without a special', () => {
    const product = toClientProduct({
      ...summary,
      ...detailFields,
      isSpecialActive: false,
      specialLabel: null,
      effectivePriceCents: 150000,
      images: [
        { id: 'i1', url: 'a.webp', thumbnailUrl: null, width: 1600, height: 1200 },
        { id: 'i2', url: 'b.webp', thumbnailUrl: null, width: 1600, height: 1200 },
      ],
      quantityAvailable: 0,
      comboSizes: { shirt: 'M', pants: '32' },
      size: null,
    });

    expect(product.images).toEqual(['a.webp', 'b.webp']);
    expect(product.originalPrice).toBeNull();
    expect(product.specialLabel).toBe('');
    expect(product.quantity).toBe(0);
    expect(product.gearSize).toBe('Shirt M / Pants 32');
  });
});

describe('service fee', () => {
  it('maps a missing serviceFeeCents to a zero fee', () => {
    expect(
      toClientProduct({ ...summary, serviceFeeCents: undefined as unknown as number }).serviceFee,
    ).toBe(0);
  });

  it('labels a fee and gives no label for zero or missing', () => {
    expect(formatServiceFeeLabel(110)).toBe('incl. R110.00 service fee');
    expect(formatServiceFeeLabel(0)).toBe('');
    expect(formatServiceFeeLabel(-5)).toBe('');
    expect(formatServiceFeeLabel(undefined)).toBe('');
  });
});

describe('toClientProduct thumbnails', () => {
  it('uses server thumbnails when present', () => {
    const product = toClientProduct({
      ...summary,
      ...detailFields,
      primaryThumbnailUrl: 'thumb.webp',
      images: [
        { id: 'i1', url: 'a.webp', thumbnailUrl: 'a-thumb.webp', width: 1600, height: 1200 },
      ],
    });

    expect(product.primaryThumbnail).toBe('thumb.webp');
    expect(product.thumbnails).toEqual(['a-thumb.webp']);
    expect(product.images).toEqual(['a.webp']);
  });

  it('falls back to the full image before thumbnails exist', () => {
    const product = toClientProduct(summary);
    expect(product.primaryThumbnail).toBe(summary.primaryImageUrl);
  });
});

describe('toCategoryKey', () => {
  it('accepts labels or keys', () => {
    expect(toCategoryKey('Gear')).toBe('gear');
    expect(toCategoryKey('parts')).toBe('parts');
    expect(toCategoryKey('')).toBeUndefined();
    expect(toCategoryKey('Bikes')).toBeUndefined();
  });
});

describe('fetchProducts', () => {
  it('sends backend keys and cents and maps the page', async () => {
    const fetchMock = stubJson({ items: [summary], nextCursor: 'c2' });

    const page = await fetchProducts({
      category: 'Gear',
      condition: ['used', 'used_good'],
      minPrice: 100,
      maxPrice: 999.99,
      q: '',
    });

    const url = new URL(callOf(fetchMock, 0).url, 'http://x');
    expect(url.pathname).toBe('/products');
    expect(url.searchParams.get('category')).toBe('gear');
    expect(url.searchParams.get('condition')).toBe('used,used_good');
    expect(url.searchParams.get('minPriceCents')).toBe('10000');
    expect(url.searchParams.get('maxPriceCents')).toBe('99999');
    expect(url.searchParams.has('q')).toBe(false);
    expect(page.nextCursor).toBe('c2');
    expect(page.items[0]?.price).toBe(1200);
  });
});

describe('fetchProductById', () => {
  it('returns null for a 404', async () => {
    stubJson({ status: 404, code: 'NOT_FOUND' }, 404);
    await expect(fetchProductById('missing')).resolves.toBeNull();
  });
});

describe('recordProductView', () => {
  it('never throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchImpl>(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(recordProductView('p1')).resolves.toBeUndefined();
  });
});

describe('fetchFaqs', () => {
  it('orders by position', async () => {
    stubJson({
      items: [
        { id: 'b', position: 2 },
        { id: 'a', position: 1 },
      ],
    });
    expect((await fetchFaqs()).map((faq) => faq.id)).toEqual(['a', 'b']);
  });
});
