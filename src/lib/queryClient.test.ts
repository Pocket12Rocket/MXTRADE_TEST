import { describe, expect, it } from 'vitest';
import { ApiProblemError } from '@/lib/apiClient';
import { makeQueryClient, shouldRetry } from '@/lib/queryClient';

describe('shouldRetry', () => {
  it('never retries a 4xx problem', () => {
    expect(shouldRetry(0, new ApiProblemError({ status: 404 }))).toBe(false);
    expect(shouldRetry(0, new ApiProblemError({ status: 429 }))).toBe(false);
  });

  it('retries network errors and 5xx twice', () => {
    expect(shouldRetry(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(shouldRetry(1, new ApiProblemError({ status: 503 }))).toBe(true);
    expect(shouldRetry(2, new ApiProblemError({ status: 503 }))).toBe(false);
  });
});

describe('makeQueryClient', () => {
  it('uses the retry policy, no focus refetch and no mutation retries', () => {
    const { queries, mutations } = makeQueryClient().getDefaultOptions();
    expect(queries?.retry).toBe(shouldRetry);
    expect(queries?.refetchOnWindowFocus).toBe(false);
    expect(mutations?.retry).toBe(false);
  });

  it('lets a test override the retry default', () => {
    expect(makeQueryClient({ retry: false }).getDefaultOptions().queries?.retry).toBe(false);
  });
});
