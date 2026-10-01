import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGoogleSignInUrl, getMe, login } from './auth';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getGoogleSignInUrl', () => {
  it('passes the client app and a relative returnTo', () => {
    expect(getGoogleSignInUrl('/profile')).toBe('/auth/google?app=client&returnTo=%2Fprofile');
  });

  it('falls back to / for absolute or protocol-relative targets', () => {
    expect(getGoogleSignInUrl('https://evil.example')).toBe('/auth/google?app=client&returnTo=%2F');
    expect(getGoogleSignInUrl('//evil.example')).toBe('/auth/google?app=client&returnTo=%2F');
  });
});

describe('getMe', () => {
  it('returns null when signed out instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: 401, code: 'AUTH_UNAUTHENTICATED' }), {
            status: 401,
            headers: { 'content-type': 'application/problem+json' },
          }),
      ),
    );

    await expect(getMe()).resolves.toBeNull();
  });
});

describe('login', () => {
  it('does not try a refresh on a wrong password', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: 401, code: 'AUTH_TOKEN_EXPIRED' }), {
          status: 401,
          headers: { 'content-type': 'application/problem+json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(login('a@b.co', 'x')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
