import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmDelivery } from './returns';

/**
 * Why: Stubs `fetch` with a JSON response and returns the mock for assertions.
 * @param {*} body - JSON body to return.
 * @param {number} [status=200] - HTTP status.
 * @param {string} [contentType] - Response content type (`application/problem+json` for errors).
 * @returns {import('vitest').Mock} The fetch mock.
 */
function stubFetch(body, status = 200, contentType = 'application/json') {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('confirmDelivery', () => {
  it('POSTs to confirm-delivery and returns the completed order', async () => {
    const fetchMock = stubFetch({ id: 'o1', status: 'completed', completedBy: 'buyer' });

    const order = await confirmDelivery('o1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/orders\/o1\/confirm-delivery$/);
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).has('X-Order-Token')).toBe(false);
    expect(order.status).toBe('completed');
  });

  it('sends X-Order-Token when a guest token is given', async () => {
    const fetchMock = stubFetch({ id: 'o1', status: 'completed' });

    await confirmDelivery('o1', 'tok-1');

    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('X-Order-Token')).toBe('tok-1');
  });

  it('rejects when the order is not confirmable (409)', async () => {
    stubFetch(
      { type: 'about:blank', title: 'Conflict', status: 409, code: 'ORDER_NOT_CONFIRMABLE' },
      409,
      'application/problem+json',
    );

    await expect(confirmDelivery('o1')).rejects.toMatchObject({
      status: 409,
      code: 'ORDER_NOT_CONFIRMABLE',
    });
  });
});
