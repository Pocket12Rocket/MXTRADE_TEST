import type { Mock } from 'vitest';

// Why: Tests read the request that `apiRequest` handed to `fetch`; typing it once here keeps
// the call-site assertions free of casts.
export type RecordedInit = Omit<RequestInit, 'headers' | 'body'> & {
  headers: Record<string, string>;
  body: string & FormData;
};

/** The shape of the `fetch` stub the API tests install with `vi.stubGlobal`. */
export type FetchImpl = (url: string, init: RecordedInit) => Promise<Response>;

/** A `vi.fn` typed as `FetchImpl`. */
export type FetchMock = Mock<FetchImpl>;

/**
 * Why: `mock.calls[n]` is possibly undefined under `noUncheckedIndexedAccess`, so tests read a
 * recorded call through one accessor that fails loudly when the call never happened.
 * @param mock - The fetch mock.
 * @param index - Zero-based call number.
 * @returns The URL and request init of that call.
 * @example
 * const { url, init } = callOf(fetchMock, 1);
 */
export function callOf(mock: FetchMock, index = 0): { url: string; init: RecordedInit } {
  const call = mock.mock.calls[index];
  if (!call) {
    throw new Error(`fetch was not called ${index + 1} time(s)`);
  }
  return { url: call[0], init: call[1] };
}
