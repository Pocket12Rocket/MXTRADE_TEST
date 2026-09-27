import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProblemError, apiRequest, getFieldErrors } from '../../lib/apiClient';

/**
 * Why: Builds an RFC 9457 problem response the way the backend sends it.
 * @param {number} status - HTTP status.
 * @param {object} [body] - Extra problem members.
 * @returns {Response} The fake response.
 */
function problem(status, body = {}) {
  return new Response(JSON.stringify({ status, title: 'Problem', ...body }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('sends cookies and the CSRF header on mutations, not on GET', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/me');
    await apiRequest('/me', { method: 'PATCH', body: { firstName: 'Sam' } });

    const [, getInit] = fetchMock.mock.calls[0];
    const [, patchInit] = fetchMock.mock.calls[1];
    expect(getInit.credentials).toBe('include');
    expect(getInit.headers['X-Requested-With']).toBeUndefined();
    expect(patchInit.headers['X-Requested-With']).toBe('FastSport');
    expect(patchInit.headers['Content-Type']).toBe('application/json');
    expect(patchInit.body).toBe(JSON.stringify({ firstName: 'Sam' }));
  });

  it('does not set Content-Type for multipart bodies', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.append('file', new Blob(['x']), 'a.webp');

    const result = await apiRequest('/uploads', { method: 'POST', body: form });

    const [, init] = fetchMock.mock.calls[0];
    expect(result).toBeNull();
    expect(init.body).toBe(form);
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.headers['X-Requested-With']).toBe('FastSport');
  });

  it('skips empty query params and repeats arrays', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/products', { query: { category: 'Gear', q: '', cursor: null, model: ['A', 'B'] } });

    expect(fetchMock.mock.calls[0][0]).toBe('/products?category=Gear&model=A&model=B');
  });

  it('refreshes once and retries when the access token expired', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(problem(401, { code: 'AUTH_TOKEN_EXPIRED' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'u1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const me = await apiRequest('/me');

    expect(me).toEqual({ id: 'u1' });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/me', '/auth/refresh', '/me']);
  });

  it('does not refresh on other 401 codes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(problem(401, { code: 'AUTH_UNAUTHENTICATED' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/me')).rejects.toMatchObject({ code: 'AUTH_UNAUTHENTICATED', status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('turns non-problem error pages into ApiProblemError with the status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 502, headers: { 'content-type': 'text/html' } })));

    const error = await apiRequest('/products').catch((err) => err);

    expect(error).toBeInstanceOf(ApiProblemError);
    expect(error.status).toBe(502);
  });
});

describe('getFieldErrors', () => {
  it('maps errors[] to the first message per path', () => {
    const error = new ApiProblemError({
      status: 422,
      errors: [
        { path: 'city', message: 'City is required' },
        { path: 'city', message: 'second' },
        { path: 'phone', message: 'Invalid phone' },
      ],
    });

    expect(getFieldErrors(error)).toEqual({ city: 'City is required', phone: 'Invalid phone' });
  });

  it('returns {} for other errors', () => {
    expect(getFieldErrors(new Error('x'))).toEqual({});
  });
});
