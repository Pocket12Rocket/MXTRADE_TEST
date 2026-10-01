import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmDelivery } from './returns';
import { callOf, type FetchImpl } from '@/test/fetch';

/**
 * Why: Stubs `fetch` with a JSON response and returns the mock for assertions.
 * @param body - JSON body to return.
 * @param status - HTTP status.
 * @param contentType - Response content type (`application/problem+json` for errors).
 * @returns The fetch mock.
 */
function stubFetch(body: unknown, status = 200, contentType = 'application/json') {
  const fetchMock = vi.fn<FetchImpl>(
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

    const { url, init } = callOf(fetchMock, 0);
    expect(url).toMatch(/\/orders\/o1\/confirm-delivery$/);
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).has('X-Order-Token')).toBe(false);
    expect(order.status).toBe('completed');
  });

  it('sends X-Order-Token when a guest token is given', async () => {
    const fetchMock = stubFetch({ id: 'o1', status: 'completed' });

    await confirmDelivery('o1', 'tok-1');

    expect(new Headers(callOf(fetchMock, 0).init.headers).get('X-Order-Token')).toBe('tok-1');
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
