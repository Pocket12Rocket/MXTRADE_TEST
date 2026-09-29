import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildRefundFormData,
  cancelOrder,
  createOrder,
  formatRands,
  getOrder,
  getOrderToken,
  quoteCheckout,
  requestRefund,
  startPayfast,
  storeOrderToken,
  submitPayfastForm,
  toProvinceValue,
} from '../../lib/api/orders';

/**
 * Why: Stubs `fetch` with a JSON response and returns the mock for assertions.
 * @param {*} body - JSON body to return.
 * @param {number} [status=200] - HTTP status.
 * @returns {import('vitest').Mock} The fetch mock.
 */
function stubFetch(body, status = 200) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  document.body.innerHTML = '';
});

describe('order token header', () => {
  it('sends X-Order-Token when a token is given and omits it otherwise', async () => {
    const fetchMock = stubFetch({ id: 'o1' });

    await getOrder('o1', 'secret');
    await getOrder('o1');
    await startPayfast('o1', 'secret');
    await cancelOrder('o1', 'secret');

    expect(fetchMock.mock.calls[0][1].headers['X-Order-Token']).toBe('secret');
    expect(fetchMock.mock.calls[1][1].headers['X-Order-Token']).toBeUndefined();
    expect(fetchMock.mock.calls[2][0]).toMatch(/\/orders\/o1\/payfast$/);
    expect(fetchMock.mock.calls[2][1].headers['X-Order-Token']).toBe('secret');
    expect(fetchMock.mock.calls[3][0]).toMatch(/\/orders\/o1\/cancel$/);
  });

  it('stores and reads the token per order in sessionStorage', () => {
    storeOrderToken('o1', 'tok1');
    storeOrderToken('o2', 'tok2');

    expect(getOrderToken('o1')).toBe('tok1');
    expect(getOrderToken('o2')).toBe('tok2');
    expect(getOrderToken('other')).toBe('');
  });

  it('does not throw when storage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => storeOrderToken('o1', 'tok')).not.toThrow();
    spy.mockRestore();
  });
});

describe('quoteCheckout and createOrder', () => {
  it('maps cart items to productId/quantity and tags quote items with id', async () => {
    const fetchMock = stubFetch({
      items: [{ productId: 'p1', name: 'Helmet', unitPriceCents: 1000, quantity: 2, lineTotalCents: 2000, available: true, availableQuantity: 5 }],
      subtotalCents: 2000,
      deliveryFeeCents: 15000,
      sellerCount: 1,
      totalCents: 17000,
    });

    const quote = await quoteCheckout([{ id: 'p1', quantity: 2, price: 10 }]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/checkout\/quote$/);
    expect(JSON.parse(init.body)).toEqual({ items: [{ productId: 'p1', quantity: 2 }] });
    expect(quote.items[0].id).toBe('p1');
    expect(quote.deliveryFeeCents).toBe(15000);
  });

  it('sends guest email and terms only when provided', async () => {
    const fetchMock = stubFetch({ order: { id: 'o1' }, accessToken: 't' }, 201);

    await createOrder({ items: [{ id: 'p1', quantity: 1 }], shippingAddress: { city: 'X' }, buyerEmail: 'a@b.co', acceptTerms: true });
    await createOrder({ items: [{ id: 'p1', quantity: 1 }], shippingAddress: { city: 'X' } });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      items: [{ productId: 'p1', quantity: 1 }],
      shippingAddress: { city: 'X' },
      buyerEmail: 'a@b.co',
      acceptTerms: true,
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      items: [{ productId: 'p1', quantity: 1 }],
      shippingAddress: { city: 'X' },
    });
  });
});

describe('helpers', () => {
  it('maps province labels to backend enum values', () => {
    expect(toProvinceValue('KwaZulu-Natal')).toBe('kwazulu_natal');
    expect(toProvinceValue('gauteng')).toBe('gauteng');
    expect(toProvinceValue('Nowhere')).toBe('');
  });

  it('formats cents as rands', () => {
    expect(formatRands(129950)).toBe('R1299.50');
    expect(formatRands(undefined)).toBe('R0.00');
  });
});

describe('refund request', () => {
  it('builds multipart with JSON data and images', () => {
    const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })];

    const form = buildRefundFormData({ reason: 'Damaged', files });

    expect(JSON.parse(form.get('data'))).toEqual({ reason: 'Damaged' });
    expect(form.getAll('images')).toHaveLength(2);
  });

  it('posts FormData to the refund endpoint with the order token', async () => {
    const fetchMock = stubFetch({ id: 'o1', status: 'refund_pending' }, 201);
    const file = new File(['a'], 'a.png', { type: 'image/png' });

    await requestRefund('o1', { reason: 'Damaged', files: [file] }, 'secret');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/orders\/o1\/refund-request$/);
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.headers['X-Order-Token']).toBe('secret');
  });
});

describe('submitPayfastForm', () => {
  it('builds a hidden POST form with every field and submits it', () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});

    const form = submitPayfastForm({
      action: 'https://sandbox.payfast.co.za/eng/process',
      fields: { merchant_id: '1', amount: '170.00' },
    });

    expect(form.method).toBe('post');
    expect(form.action).toBe('https://sandbox.payfast.co.za/eng/process');
    expect(form.querySelector('input[name="merchant_id"]').value).toBe('1');
    expect(form.querySelector('input[name="amount"]').value).toBe('170.00');
    expect(submit).toHaveBeenCalledTimes(1);
    submit.mockRestore();
  });

  it('rejects a non-https action', () => {
    expect(() => submitPayfastForm({ action: 'http://evil.example', fields: {} })).toThrow();
  });
});
