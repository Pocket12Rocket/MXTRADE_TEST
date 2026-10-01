import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelCheckout,
  createCheckout,
  formatQuoteUnitPrice,
  getCheckout,
  quoteCheckout,
  startCheckoutPayfast,
} from './checkouts';
import { getOrderToken, storeCheckoutToken } from './orders';
import { callOf, type FetchImpl } from '@/test/fetch';
import type { ShippingAddress } from './types';

const address: ShippingAddress = {
  firstName: 'Sam',
  lastName: 'Test',
  phone: '0825550100',
  streetAddress: '1 Main Road',
  suburb: 'Sea Point',
  city: 'Cape Town',
  province: 'western_cape',
  postalCode: '8005',
};

/**
 * Why: Stubs `fetch` with a JSON response and returns the mock for assertions.
 * @param body - JSON body to return.
 * @param status - HTTP status.
 * @returns The fetch mock.
 */
function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn<FetchImpl>(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('checkout paths and token header', () => {
  it('calls the checkout endpoints and sends X-Order-Token only when given', async () => {
    const fetchMock = stubFetch({ id: 'c1' });

    await getCheckout('c1', 'secret');
    await getCheckout('c1');
    await startCheckoutPayfast('c1', 'secret');
    await cancelCheckout('c1', 'secret');

    expect(callOf(fetchMock, 0).url).toMatch(/\/checkouts\/c1$/);
    expect(callOf(fetchMock, 0).init.headers['X-Order-Token']).toBe('secret');
    expect(callOf(fetchMock, 1).init.headers['X-Order-Token']).toBeUndefined();
    expect(callOf(fetchMock, 2).url).toMatch(/\/checkouts\/c1\/payfast$/);
    expect(callOf(fetchMock, 2).init.method).toBe('POST');
    expect(callOf(fetchMock, 2).init.headers['X-Order-Token']).toBe('secret');
    expect(callOf(fetchMock, 3).url).toMatch(/\/checkouts\/c1\/cancel$/);
    expect(callOf(fetchMock, 3).init.method).toBe('POST');
  });

  it('surfaces a 503 SERVICE_UNAVAILABLE problem with its code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchImpl>(
        async () =>
          new Response(
            JSON.stringify({
              status: 503,
              code: 'SERVICE_UNAVAILABLE',
              title: 'Service Unavailable',
            }),
            { status: 503, headers: { 'content-type': 'application/problem+json' } },
          ),
      ),
    );

    await expect(startCheckoutPayfast('c1', 'tok')).rejects.toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });
});

describe('formatQuoteUnitPrice', () => {
  it('shows the seller price when it is at or below what the buyer pays', () => {
    expect(formatQuoteUnitPrice({ unitPriceCents: 30000, sellerUnitPriceCents: 25000 })).toBe(
      'R300.00 each, seller price R250.00',
    );
    expect(formatQuoteUnitPrice({ unitPriceCents: 25000, sellerUnitPriceCents: 25000 })).toBe(
      'R250.00 each, seller price R250.00',
    );
  });

  it('hides the seller price when a special takes the price below it', () => {
    expect(formatQuoteUnitPrice({ unitPriceCents: 24000, sellerUnitPriceCents: 30000 })).toBe(
      'R240.00 each',
    );
  });
});

describe('quoteCheckout', () => {
  const helmet = {
    productId: 'p1',
    name: 'Helmet',
    unitPriceCents: 1100,
    sellerUnitPriceCents: 1000,
    quantity: 2,
    lineTotalCents: 2200,
    available: true,
    availableQuantity: 5,
  };
  const boots = {
    productId: 'p2',
    name: 'Boots',
    unitPriceCents: 3300,
    sellerUnitPriceCents: 3000,
    quantity: 1,
    lineTotalCents: 3300,
    available: true,
    availableQuantity: 1,
  };
  const gone = {
    productId: 'p3',
    name: 'Gone',
    unitPriceCents: 550,
    sellerUnitPriceCents: 500,
    quantity: 1,
    lineTotalCents: 0,
    available: false,
    availableQuantity: 0,
  };

  it('posts productId/quantity to /checkout/quote and tags every line, grouped or flat, with its id', async () => {
    const fetchMock = stubFetch({
      items: [helmet, gone, boots],
      sellers: [
        {
          seller: { id: 's1', name: 'Ann' },
          items: [helmet, gone],
          itemsCents: 2000,
          serviceFeeCents: 200,
          subtotalCents: 2200,
          deliveryFeeCents: 15000,
          totalCents: 17200,
        },
        {
          seller: { id: 's2', name: 'Bob' },
          items: [boots],
          itemsCents: 3000,
          serviceFeeCents: 300,
          subtotalCents: 3300,
          deliveryFeeCents: 15000,
          totalCents: 18300,
        },
      ],
      itemsCents: 5000,
      serviceFeeCents: 500,
      subtotalCents: 5500,
      deliveryFeeCents: 30000,
      sellerCount: 2,
      totalCents: 35500,
    });

    // Why: real cart items carry more fields than the quote needs; only id and quantity are sent.
    const cartItem = { id: 'p1', quantity: 2, price: 10 };
    const quote = await quoteCheckout([cartItem]);

    const { url, init } = callOf(fetchMock, 0);
    expect(url).toMatch(/\/checkout\/quote$/);
    expect(JSON.parse(init.body)).toEqual({ items: [{ productId: 'p1', quantity: 2 }] });
    expect(quote.items.map((item) => item.id)).toEqual(['p1', 'p3', 'p2']);
    expect(quote.sellers).toHaveLength(2);
    expect(quote.sellers[0]?.seller).toEqual({ id: 's1', name: 'Ann' });
    expect(quote.sellers[0]?.serviceFeeCents).toBe(200);
    expect(quote.sellers[0]?.items.map((item) => item.id)).toEqual(['p1', 'p3']);
    expect(quote.sellers[0]?.items[1]).toMatchObject({
      available: false,
      availableQuantity: 0,
      sellerUnitPriceCents: 500,
    });
    expect(quote).toMatchObject({ itemsCents: 5000, serviceFeeCents: 500, totalCents: 35500 });
    expect((quote as Record<string, unknown>).unassignedItems).toBeUndefined();
  });

  it('tolerates a quote without sellers', async () => {
    stubFetch({ items: [], subtotalCents: 0, deliveryFeeCents: 0, sellerCount: 0, totalCents: 0 });

    const quote = await quoteCheckout([{ id: 'p1', quantity: 1 }]);

    expect(quote.sellers).toEqual([]);
  });
});

describe('createCheckout', () => {
  it('posts to /checkouts and sends guest email and terms only when provided', async () => {
    const fetchMock = stubFetch({ checkout: { id: 'c1', orders: [] }, accessToken: 't' }, 201);

    await createCheckout({
      items: [{ id: 'p1', quantity: 1 }],
      shippingAddress: address,
      buyerEmail: 'a@b.co',
      acceptTerms: true,
    });
    await createCheckout({ items: [{ id: 'p1', quantity: 1 }], shippingAddress: address });

    expect(callOf(fetchMock, 0).url).toMatch(/\/checkouts$/);
    expect(JSON.parse(callOf(fetchMock, 0).init.body)).toEqual({
      items: [{ productId: 'p1', quantity: 1 }],
      shippingAddress: address,
      buyerEmail: 'a@b.co',
      acceptTerms: true,
    });
    expect(JSON.parse(callOf(fetchMock, 1).init.body)).toEqual({
      items: [{ productId: 'p1', quantity: 1 }],
      shippingAddress: address,
    });
  });

  it('lets the returned checkout token be read back by checkout id and by each order id', async () => {
    stubFetch(
      { checkout: { id: 'c1', orders: [{ id: 'o1' }, { id: 'o2' }] }, accessToken: 'tok' },
      201,
    );

    const { checkout, accessToken } = await createCheckout({
      items: [{ id: 'p1', quantity: 1 }],
      shippingAddress: address,
    });
    storeCheckoutToken(checkout, accessToken);

    expect(getOrderToken('c1')).toBe('tok');
    expect(getOrderToken('o1')).toBe('tok');
    expect(getOrderToken('o2')).toBe('tok');
  });
});
