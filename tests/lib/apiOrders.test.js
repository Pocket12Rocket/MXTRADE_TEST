import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildRefundFormData,
  fetchPrivateImageBlob,
  formatRands,
  getOrder,
  getOrderToken,
  getPaymentStepCopy,
  getRefundRules,
  getRefundStatusLabel,
  getRefundTypeLabel,
  REFUND_TYPES,
  getQuoteLineIssue,
  ORDER_STATUSES,
  orderStatusColour,
  requestRefund,
  storeCheckoutToken,
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

    expect(fetchMock.mock.calls[0][1].headers['X-Order-Token']).toBe('secret');
    expect(fetchMock.mock.calls[1][1].headers['X-Order-Token']).toBeUndefined();
  });

  it('stores and reads the token per order in sessionStorage', () => {
    storeOrderToken('o1', 'tok1');
    storeOrderToken('o2', 'tok2');

    expect(getOrderToken('o1')).toBe('tok1');
    expect(getOrderToken('o2')).toBe('tok2');
    expect(getOrderToken('other')).toBe('');
  });

  it('indexes a checkout token under the checkout id and every order id', () => {
    storeCheckoutToken({ id: 'c1', orders: [{ id: 'o1' }, { id: 'o2' }] }, 'ctok');

    expect(getOrderToken('c1')).toBe('ctok');
    expect(getOrderToken('o1')).toBe('ctok');
    expect(getOrderToken('o2')).toBe('ctok');
    expect(getOrderToken('o3')).toBe('');
  });

  it('does not throw when storage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => storeOrderToken('o1', 'tok')).not.toThrow();
    spy.mockRestore();
  });
});

describe('getQuoteLineIssue', () => {
  it('flags unavailable lines, reduced quantities and fine lines', () => {
    expect(getQuoteLineIssue({ available: false, availableQuantity: 0, quantity: 1 })).toBe('unavailable');
    expect(getQuoteLineIssue({ available: true, availableQuantity: 0, quantity: 1 })).toBe('unavailable');
    expect(getQuoteLineIssue({ available: true, availableQuantity: 1, quantity: 3 })).toBe('reduced');
    expect(getQuoteLineIssue({ available: true, availableQuantity: 3, quantity: 3 })).toBeNull();
  });
});

describe('orderStatusColour', () => {
  it('has a distinct colour for every backend OrderStatus and a fallback for unknown ones', () => {
    ORDER_STATUSES.forEach((status) => {
      expect(orderStatusColour(status)).toMatch(/^bg-/);
    });
    expect(orderStatusColour('late_payment')).toBe('bg-amber-100 text-amber-700');
    expect(ORDER_STATUSES).toContain('completed');
    expect(orderStatusColour('completed')).toBe('bg-teal-100 text-teal-700');
    expect(orderStatusColour('purchased')).toBe('bg-slate-100 text-slate-700');
  });
});

describe('getPaymentStepCopy', () => {
  it('describes a late payment as under review and everything else as confirmed', () => {
    expect(getPaymentStepCopy('late_payment').label).toBe('Payment under review');
    expect(getPaymentStepCopy('late_payment').sublabel).toContain('Items still in stock are held for you');
    expect(getPaymentStepCopy('paid').label).toBe('Payment Confirmed');
    expect(getPaymentStepCopy(undefined).label).toBe('Payment Confirmed');
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

const BANK = { accountHolder: 'A Buyer', bankName: 'FNB', accountType: 'savings', branchCode: '250655', accountNumber: '62123456789' };

describe('refund request', () => {
  it('builds multipart with JSON data and images', () => {
    const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })];

    const form = buildRefundFormData({ type: 'damaged', reason: 'Damaged', bankAccount: BANK, files });

    expect(JSON.parse(form.get('data'))).toEqual({ type: 'damaged', reason: 'Damaged', bankAccount: BANK });
    expect(form.getAll('images')).toHaveLength(2);
  });

  it.each(REFUND_TYPES.map((item) => item.value))('puts type %s in the data JSON', (type) => {
    const form = buildRefundFormData({ type, reason: 'Reason', bankAccount: BANK, files: [] });

    expect(JSON.parse(form.get('data')).type).toBe(type);
    expect(form.getAll('images')).toHaveLength(0);
  });

  it('posts FormData to the refund endpoint with the order token', async () => {
    const fetchMock = stubFetch({ id: 'o1', status: 'refund_pending' }, 201);
    const file = new File(['a'], 'a.png', { type: 'image/png' });

    await requestRefund('o1', { type: 'damaged', reason: 'Damaged', bankAccount: BANK, files: [file] }, 'secret');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/orders\/o1\/refund-request$/);
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.headers['X-Order-Token']).toBe('secret');
  });
});

describe('refund types', () => {
  it('labels every type and passes unknown values through', () => {
    expect(getRefundTypeLabel('damaged')).toBe('Item arrived damaged');
    expect(getRefundTypeLabel('not_as_described')).toBe('Not as described');
    expect(getRefundTypeLabel('never_arrived')).toBe('Never arrived');
    expect(getRefundTypeLabel('other')).toBe('Other issue');
    expect(getRefundTypeLabel('mystery')).toBe('mystery');
    expect(getRefundTypeLabel(undefined)).toBe('');
  });

  it('requires photos except for never_arrived, and 20 characters for other', () => {
    expect(getRefundRules('damaged')).toEqual({ minImages: 1, maxImages: 5, minReasonLength: 1 });
    expect(getRefundRules('not_as_described').minImages).toBe(1);
    expect(getRefundRules('never_arrived')).toEqual({ minImages: 0, maxImages: 5, minReasonLength: 1 });
    expect(getRefundRules('other')).toEqual({ minImages: 1, maxImages: 5, minReasonLength: 20 });
    expect(getRefundRules('').minImages).toBe(1);
  });
});

describe('refund status labels', () => {
  it('maps every RefundStatus to a friendly label and passes unknown values through', () => {
    expect(getRefundStatusLabel('pending')).toBe('Under review');
    expect(getRefundStatusLabel('accepted')).toBe('Accepted, awaiting your EFT refund');
    expect(getRefundStatusLabel('denied')).toBe('Denied');
    expect(getRefundStatusLabel('paid')).toBe('Refunded');
    expect(getRefundStatusLabel('mystery')).toBe('mystery');
  });
});

describe('fetchPrivateImageBlob', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends credentials and the order token header and returns the blob', async () => {
    const image = new Blob(['img'], { type: 'image/webp' });
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, blob: async () => image }));
    vi.stubGlobal('fetch', fetchMock);

    // Why: API_BASE_URL is empty in tests, so the API origin is the page's own origin.
    const imageUrl = `${window.location.origin}/files/private/k`;
    const blob = await fetchPrivateImageBlob(imageUrl, 'secret');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(imageUrl);
    expect(init.credentials).toBe('include');
    expect(init.headers['X-Order-Token']).toBe('secret');
    expect(blob).toBe(image);
  });

  it('throws on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 403 })));
    await expect(fetchPrivateImageBlob('/files/private/x', 'bad')).rejects.toThrow('403');
  });

  it('never sends the token to another origin', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchPrivateImageBlob('https://evil.example/steal.webp', 'secret')).rejects.toThrow(/non-API/);
    expect(fetchMock).not.toHaveBeenCalled();
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
