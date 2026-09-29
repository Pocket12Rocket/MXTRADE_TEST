import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendContactMessage } from '../../lib/api/contact';
import { ApiProblemError } from '../../lib/apiClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendContactMessage', () => {
  it('posts name, email and message to /contact', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: 'Sent' }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendContactMessage({ name: 'Sam', email: 'sam@example.com', message: 'Hi' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/contact$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'Sam', email: 'sam@example.com', message: 'Hi' });
    expect(result).toEqual({ message: 'Sent' });
  });

  it('surfaces a 429 as an ApiProblemError with its code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ status: 429, title: 'Too many', code: 'RATE_LIMITED' }),
      { status: 429, headers: { 'content-type': 'application/problem+json' } },
    )));

    await expect(sendContactMessage({ name: 'a', email: 'a@b.co', message: 'x' })).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
    });
    await expect(sendContactMessage({ name: 'a', email: 'a@b.co', message: 'x' })).rejects.toBeInstanceOf(ApiProblemError);
  });
});
