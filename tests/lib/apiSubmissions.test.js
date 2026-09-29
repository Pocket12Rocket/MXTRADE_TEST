import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSubmissionFormData,
  createSubmission,
  deleteSubmission,
  editLiveProduct,
  fetchMarkupQuote,
  listMyProducts,
  listMySubmissions,
  removeMyProduct,
  toSellerListing,
  toSubmissionInput,
  updateSubmission,
} from '../../lib/api/submissions';
import { defaultGearSizes, emptyListingForm, mapSubmissionErrors, validateListingForm } from '../../lib/listingForm';
import { ApiProblemError } from '../../lib/apiClient';

const config = {
  categories: [
    { key: 'gear', label: 'Gear', subcategories: ['Boots', 'Gear Combo', 'Goggles', 'Helmet'] },
    { key: 'parts', label: 'Parts', subcategories: ['Brakes', 'Engine'] },
    { key: 'accessories', label: 'Accessories', subcategories: ['Tie Downs & Straps'] },
  ],
  conditions: [
    { key: 'new_in_packaging', label: 'New - Original Packaging' },
    { key: 'used', label: 'Used' },
  ],
  brands: ['Fox Racing', 'Shoei'],
  bikeManufacturers: [{ name: 'KTM', models: ['250 SX-F', '450 SX-F'] }],
  gearSizes: {
    lists: { alpha: ['S', 'M'], pants: ['30', '32'], boots: ['UK8'], gloves: ['M'] },
    byGearItem: { Helmet: 'alpha', Boots: 'boots', Goggles: 'none', 'Gear Combo': 'combo' },
  },
};

const submission = {
  id: 's1',
  status: 'rejected',
  rejectionReason: 'Photos are blurry',
  category: 'gear',
  categoryLabel: 'Gear',
  subcategory: 'Helmet',
  name: 'Fox Racing Helmet',
  description: 'Barely used',
  condition: 'used',
  conditionLabel: 'Used',
  brand: 'Fox Racing',
  manufacturer: null,
  models: [],
  universalFit: false,
  size: 'M',
  comboSizes: null,
  quantity: 2,
  sellerPriceCents: 45000,
  listPriceCents: 54000,
  markupPercent: 20,
  images: [
    { id: 'i1', url: 'http://localhost:4000/files/a.webp', thumbnailUrl: 'http://localhost:4000/files/a-t.webp' },
    { id: 'i2', url: 'http://localhost:4000/files/b.webp', thumbnailUrl: null },
  ],
  originalProductId: null,
  productId: null,
  createdAt: '2026-09-20T10:00:00Z',
  updatedAt: '2026-09-21T10:00:00Z',
};

/**
 * Why: Stubs fetch with one JSON response and returns the mock for URL, method and body assertions.
 * @param {object|null} body - JSON body to return (null gives an empty 204).
 * @param {number} [status=200] - HTTP status.
 * @returns {import('vitest').Mock} The fetch mock.
 */
function stubJson(body, status = 200) {
  const fetchMock = vi.fn(async () => (body === null
    ? new Response(null, { status: 204 })
    : new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
    })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toSubmissionInput', () => {
  it('builds gear input with a single size, cents and a null name', () => {
    const form = { ...emptyListingForm('gear', config), subcategory: 'Helmet', size: 'M', price: '450.50', description: ' Great ', quantity: '2' };

    expect(toSubmissionInput(form)).toEqual({
      category: 'gear',
      subcategory: 'Helmet',
      name: null,
      description: 'Great',
      condition: 'new_in_packaging',
      brand: 'Fox Racing',
      manufacturer: null,
      models: [],
      universalFit: false,
      size: 'M',
      comboSizes: null,
      quantity: 2,
      sellerPriceCents: 45050,
    });
  });

  it('builds a gear combo with comboSizes and no size, and a custom brand', () => {
    const form = {
      ...emptyListingForm('gear', config),
      subcategory: 'Gear Combo',
      ...defaultGearSizes(config, 'Gear Combo'),
      brand: '__other__',
      customBrand: ' Kayo ',
      price: '999',
      description: 'Set',
    };

    const input = toSubmissionInput(form);
    expect(input.comboSizes).toEqual({ shirt: 'S', pants: '30' });
    expect(input.size).toBeNull();
    expect(input.brand).toBe('Kayo');
  });

  it('sends a null size for sizeless gear', () => {
    const form = { ...emptyListingForm('gear', config), subcategory: 'Goggles', ...defaultGearSizes(config, 'Goggles'), price: '100', description: 'x' };
    expect(toSubmissionInput(form).size).toBeNull();
  });

  it('builds accessories input with a custom subcategory and no brand', () => {
    const form = {
      ...emptyListingForm('accessories', config),
      subcategory: '__other_subcategory__',
      customSubcategory: ' Chain lube ',
      price: '80',
      description: 'Bottle',
    };

    expect(toSubmissionInput(form)).toMatchObject({
      category: 'accessories',
      subcategory: 'Chain lube',
      name: null,
      brand: null,
      size: null,
      comboSizes: null,
      sellerPriceCents: 8000,
    });
  });

  it('builds parts input with manufacturer and merged, de-duplicated models', () => {
    const form = {
      ...emptyListingForm('parts', config),
      name: ' Brake lever ',
      condition: 'used',
      manufacturer: 'KTM',
      models: ['450 SX-F'],
      customModels: '450 SX-F, 350 SX-F',
      price: '250',
      description: 'Lever',
    };

    expect(toSubmissionInput(form)).toMatchObject({
      category: 'parts',
      name: 'Brake lever',
      manufacturer: 'KTM',
      models: ['450 SX-F', '350 SX-F'],
      universalFit: false,
      size: null,
    });
  });

  it('builds universal parts without manufacturer or models, and an Other manufacturer from text', () => {
    const base = { ...emptyListingForm('parts', config), name: 'Bolt', condition: 'used', price: '10', description: 'Bolt' };

    expect(toSubmissionInput({ ...base, manufacturer: 'Universal', models: ['x'] })).toMatchObject({
      manufacturer: null,
      models: [],
      universalFit: true,
    });
    expect(toSubmissionInput({ ...base, manufacturer: 'Other', otherManufacturer: ' Kayo ', customModels: 'K1' })).toMatchObject({
      manufacturer: 'Kayo',
      models: ['K1'],
      universalFit: false,
    });
  });

  it('includes keepImageIds only when given', () => {
    const form = emptyListingForm('accessories', config);
    expect(toSubmissionInput(form)).not.toHaveProperty('keepImageIds');
    expect(toSubmissionInput(form, { keepImageIds: ['i1'] }).keepImageIds).toEqual(['i1']);
  });
});

describe('multipart requests', () => {
  it('buildSubmissionFormData puts the JSON in `data` and each file under `images`', () => {
    const files = [new File(['a'], 'a.webp', { type: 'image/webp' }), new File(['b'], 'b.webp', { type: 'image/webp' })];
    const body = buildSubmissionFormData({ category: 'gear' }, files);

    expect(JSON.parse(body.get('data'))).toEqual({ category: 'gear' });
    expect(body.getAll('images').map((file) => file.name)).toEqual(['a.webp', 'b.webp']);
  });

  it('createSubmission POSTs multipart with the CSRF header and no JSON content type', async () => {
    const fetchMock = stubJson({ ...submission, status: 'pending' }, 201);
    const file = new File(['a'], 'a.webp', { type: 'image/webp' });

    const listing = await createSubmission({ input: { category: 'gear' }, files: [file] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/me\/submissions$/);
    expect(init.method).toBe('POST');
    expect(init.headers['X-Requested-With']).toBe('FastSport');
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
    expect(JSON.parse(init.body.get('data'))).toEqual({ category: 'gear' });
    expect(init.body.getAll('images')).toHaveLength(1);
    expect(listing.status).toBe('pending');
  });

  it('updateSubmission PUTs keepImageIds in the data field', async () => {
    const fetchMock = stubJson(submission);

    await updateSubmission('s1', { input: { keepImageIds: ['i1', 'i2'] }, files: [] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/me\/submissions\/s1$/);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body.get('data')).keepImageIds).toEqual(['i1', 'i2']);
  });

  it('editLiveProduct POSTs to the product edit endpoint', async () => {
    const fetchMock = stubJson({ ...submission, status: 'pending', originalProductId: 'p1' }, 201);

    const listing = await editLiveProduct('p1', { input: { category: 'gear' }, files: [] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/me\/products\/p1\/edit$/);
    expect(init.method).toBe('POST');
    expect(listing.originalProductId).toBe('p1');
  });

  it('delete calls use DELETE and resolve to nothing', async () => {
    const fetchMock = stubJson(null);

    await expect(deleteSubmission('s1')).resolves.toBeUndefined();
    await expect(removeMyProduct('p1')).resolves.toBeUndefined();

    expect(fetchMock.mock.calls.map(([url, init]) => `${init.method} ${url.replace(/^.*\/v1|^https?:\/\/[^/]+/, '')}`)).toEqual([
      'DELETE /me/submissions/s1',
      'DELETE /me/products/p1',
    ]);
  });
});

describe('lists', () => {
  it('listMySubmissions sends the status and cursor query and adapts the items', async () => {
    const fetchMock = stubJson({ items: [submission], nextCursor: 'c2' });

    const page = await listMySubmissions({ status: 'rejected', cursor: 'c1', limit: 25 });

    const url = new URL(fetchMock.mock.calls[0][0], 'http://localhost');
    expect(url.pathname).toMatch(/\/me\/submissions$/);
    expect(url.searchParams.get('status')).toBe('rejected');
    expect(url.searchParams.get('cursor')).toBe('c1');
    expect(url.searchParams.get('limit')).toBe('25');
    expect(page.nextCursor).toBe('c2');
    expect(page.items[0].sellerPrice).toBe(450);
  });

  it('listMyProducts adapts SellerProducts', async () => {
    stubJson({
      items: [{
        id: 'p1',
        name: 'Boots',
        category: 'gear',
        categoryLabel: 'Gear',
        status: 'listed',
        quantity: 3,
        sellerPriceCents: 10000,
        effectivePriceCents: 12000,
        pendingEditId: null,
        primaryImageUrl: 'http://localhost:4000/files/p.webp',
        primaryThumbnailUrl: 'http://localhost:4000/files/p-t.webp',
        listedAt: '2026-09-01T00:00:00Z',
      }],
      nextCursor: null,
    });

    const { items, nextCursor } = await listMyProducts();

    expect(nextCursor).toBeNull();
    expect(items[0]).toMatchObject({ kind: 'product', price: 120, sellerPrice: 100, quantity: 3, primaryThumbnail: 'http://localhost:4000/files/p-t.webp' });
  });
});

describe('toSellerListing', () => {
  it('maps a Submission to rands, image URLs, thumbnails and the category label', () => {
    const listing = toSellerListing(submission);

    expect(listing).toMatchObject({
      id: 's1',
      kind: 'submission',
      status: 'rejected',
      rejectionReason: 'Photos are blurry',
      category: 'Gear',
      categoryKey: 'gear',
      price: 540,
      sellerPrice: 450,
      quantity: 2,
      primaryImage: 'http://localhost:4000/files/a.webp',
    });
    expect(listing.images).toEqual(['http://localhost:4000/files/a.webp', 'http://localhost:4000/files/b.webp']);
    // A missing thumbnail falls back to the full image.
    expect(listing.thumbnails).toEqual(['http://localhost:4000/files/a-t.webp', 'http://localhost:4000/files/b.webp']);
    expect(listing.imageItems[0].id).toBe('i1');
    expect(listing.createdAtMillis).toBe(Date.parse('2026-09-20T10:00:00Z'));
  });

  it('reads fitment from a ProductDetail merged with seller fields', () => {
    const listing = toSellerListing({
      id: 'p1',
      category: 'parts',
      categoryLabel: 'Parts',
      name: 'Lever',
      effectivePriceCents: 30000,
      sellerPriceCents: 25000,
      quantity: 1,
      fitment: { manufacturer: 'KTM', models: ['450 SX-F'], universal: false },
      images: [{ url: 'http://localhost:4000/files/l.webp', thumbnailUrl: null }],
    });

    expect(listing).toMatchObject({ kind: 'product', manufacturer: 'KTM', models: ['450 SX-F'], universalFit: false, price: 300, sellerPrice: 250, productId: 'p1' });
  });
});

describe('fetchMarkupQuote', () => {
  it('asks the backend for the quote with integer cents in the query', async () => {
    const fetchMock = stubJson({ sellerPriceCents: 45000, listPriceCents: 54000, markupPercent: 20 });

    const quote = await fetchMarkupQuote(45000);

    const url = new URL(fetchMock.mock.calls[0][0], 'http://localhost');
    expect(url.pathname).toMatch(/\/pricing\/markup-quote$/);
    expect(url.searchParams.get('sellerPriceCents')).toBe('45000');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
    expect(quote.listPriceCents).toBe(54000);
  });
});

describe('form validation and error mapping', () => {
  it('requires 3-5 images and a description of at most 500 characters for every category', () => {
    const parts = { ...emptyListingForm('parts', config), name: 'Lever', condition: 'used', manufacturer: 'Universal', price: '10', description: 'x'.repeat(501) };

    const errors = validateListingForm(parts, config, 2);

    expect(errors.images).toMatch(/between 3 and 5/);
    expect(errors.description).toMatch(/500/);
    expect(validateListingForm({ ...parts, description: 'ok' }, config, 3)).toEqual({});
  });

  it('requires models for a parts listing unless it is universal fit', () => {
    const parts = { ...emptyListingForm('parts', config), name: 'Lever', condition: 'used', manufacturer: 'KTM', price: '10', description: 'ok' };
    expect(validateListingForm(parts, config, 3).models).toBeTruthy();
    expect(validateListingForm({ ...parts, models: ['450 SX-F'] }, config, 3)).toEqual({});
  });

  it('maps backend 422 paths to form fields and keeps unknown paths as general messages', () => {
    const err = new ApiProblemError({
      status: 422,
      errors: [
        { path: 'data.brand', message: 'Brand is required' },
        { path: 'data.sellerPriceCents', message: 'Price too low' },
        { path: 'data.models.0', message: 'Model too long' },
        { path: 'images.2', message: 'Unsupported image type' },
        { path: 'something.else', message: 'Odd' },
      ],
    });

    expect(mapSubmissionErrors(err)).toEqual({
      fields: { brand: 'Brand is required', price: 'Price too low', models: 'Model too long', images: 'Unsupported image type' },
      general: ['Odd'],
    });
  });
});
