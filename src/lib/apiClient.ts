/**
 * Why: The single place the client talks to the FastSport backend, so cookie handling, the
 * one-shot session refresh on 401 and RFC 9457 problem parsing exist once.
 */

import type { ErrorCode, FieldError, ProblemDetails } from '@/lib/api/types';

// Why: Base URL of the backend API including its version prefix (e.g. `http://localhost:4000/v1`).
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

// Why: Path of the backend's session refresh endpoint. Kept as one constant so it can be
// matched to the backend's OpenAPI contract in a single edit once that contract is published.
const REFRESH_PATH = '/auth/refresh';

const PROBLEM_CONTENT_TYPE = 'application/problem+json';

// Why: The backend rejects state-changing requests without this custom header (403 `CSRF_REJECTED`).
const CSRF_HEADER = { 'X-Requested-With': 'FastSport' };
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Why: Only this problem code means "access token expired, refresh and retry"; any other 401
// surfaces as-is.
const TOKEN_EXPIRED_CODE: ErrorCode = 'AUTH_TOKEN_EXPIRED';

/** Fields of an RFC 9457 problem document; only `status` is guaranteed. */
export type ApiProblemInput = Partial<Omit<ProblemDetails, 'status'>> & { status: number };

/** Query params for `apiRequest`; `undefined`, `null` and `''` are skipped. */
export type ApiQuery = Record<string, unknown>;

/** Options for `apiRequest`. */
export interface ApiRequestOptions {
  /** HTTP method, default `GET`. */
  method?: string;
  /** Plain object/array (sent as JSON) or `FormData` (sent as multipart). */
  body?: unknown;
  query?: ApiQuery;
  /** Optional abort signal for timeouts and unmounts. */
  signal?: AbortSignal;
  /** Extra request headers merged over the defaults, e.g. `X-Order-Token`. */
  headers?: Record<string, string>;
  /** Set false for auth endpoints where a 401 must not trigger a refresh loop. Default true. */
  retryOnUnauthorized?: boolean;
}

/**
 * Why: Carries every RFC 9457 problem-details member from a failed backend response so callers
 * (and `toUserMessage()`) can branch on the stable `code`/`status` instead of parsing text, and
 * so forms can show per-field validation messages from `errors[]`.
 * @example
 * try {
 *   await apiRequest('/checkouts', { method: 'POST', body: payload });
 * } catch (err) {
 *   if (err instanceof ApiProblemError && err.code === 'INSUFFICIENT_STOCK') {
 *     // show the stock conflict UI
 *   }
 * }
 */
export class ApiProblemError extends Error {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  /** Empty when the response carried no problem `code`. */
  code: ErrorCode | '';
  errors: FieldError[];

  /**
   * Why: Normalises a parsed problem document (or a synthetic one for non-problem responses)
   * into a typed error with safe defaults for every member.
   * @param problem - The parsed RFC 9457 problem document; only `status` is required.
   * @example
   * throw new ApiProblemError({ status: 404, title: 'Not Found', code: 'PRODUCT_NOT_FOUND' });
   */
  constructor(problem: ApiProblemInput) {
    super(problem.title || `Request failed with status ${problem.status}`);
    this.name = 'ApiProblemError';
    this.type = problem.type || 'about:blank';
    this.title = problem.title || '';
    this.status = problem.status;
    this.detail = problem.detail || '';
    this.instance = problem.instance || '';
    this.code = problem.code || '';
    this.errors = Array.isArray(problem.errors) ? problem.errors : [];
  }
}

/**
 * Why: Several callers treat one specific HTTP status (usually 404 or 401) as a normal state, so
 * the "is this an API problem with that status" check exists once instead of per call site.
 * @param err - A caught error.
 * @param status - The HTTP status to match; omit to match any `ApiProblemError`.
 * @returns True when `err` is an `ApiProblemError` (with that status, if given).
 * @example
 * if (isApiProblem(err, 404)) return null;
 */
export function isApiProblem(err: unknown, status?: number): err is ApiProblemError {
  const isProblem =
    err instanceof ApiProblemError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { name?: unknown }).name === 'ApiProblemError');
  return isProblem && (status === undefined || (err as ApiProblemError).status === status);
}

/**
 * Why: Turns the `errors[]` extension of a validation problem into a `{ fieldPath: message }`
 * map, which is the shape the existing forms already use for inline field errors.
 * @param err - A caught error; anything that is not an `ApiProblemError` yields `{}`.
 * @returns First message per field path.
 * @example
 * const fieldErrors = getFieldErrors(err); // { 'shippingAddress.city': 'City is required' }
 */
export function getFieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiProblemError)) {
    return {};
  }

  return err.errors.reduce<Record<string, string>>((acc, item) => {
    const path = String(item?.path || '');
    if (path && !acc[path]) {
      acc[path] = String(item?.message || '');
    }
    return acc;
  }, {});
}

/**
 * Why: Builds the absolute request URL, appending only defined query params so helpers can pass
 * optional filters without pre-cleaning them.
 * @param path - API path starting with `/`.
 * @param query - Query params; `undefined`, `null` and `''` are skipped, arrays are repeated as
 *   `key=a&key=b`.
 * @returns The full URL.
 * @example
 * buildUrl('/products', { category: 'Gear', page: 2 }); // '<base>/products?category=Gear&page=2'
 */
function buildUrl(path: string, query?: ApiQuery): string {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    (Array.isArray(value) ? value : [value]).forEach((item) => params.append(key, String(item)));
  });
  const search = params.toString();
  return `${API_BASE_URL}${path}${search ? `?${search}` : ''}`;
}

/**
 * Why: Converts any non-2xx response into an `ApiProblemError`, so callers get one error type
 * even for non-problem responses such as proxy error pages.
 * @param response - The failed fetch response.
 * @returns The error to throw.
 * @example
 * if (!response.ok) throw await toProblemError(response);
 */
async function toProblemError(response: Response): Promise<ApiProblemError> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes(PROBLEM_CONTENT_TYPE) || contentType.includes('application/json')) {
    try {
      const body = (await response.json()) as Partial<ProblemDetails> | null;
      return new ApiProblemError({ ...body, status: body?.status || response.status });
    } catch {
      // Fall through to the synthetic problem below when the body is not valid JSON.
    }
  }
  return new ApiProblemError({ status: response.status, title: response.statusText });
}

// Why: Single-flight guard so several requests failing with 401 at once trigger one refresh
// call, not one per request.
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Why: Asks the backend to rotate the access-token cookie using the refresh-token cookie.
 * Concurrent callers share one in-flight request.
 * @returns True when the session was refreshed.
 * @example
 * if (await refreshSession()) { retry(); }
 */
function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(buildUrl(REFRESH_PATH), {
      method: 'POST',
      credentials: 'include',
      headers: CSRF_HEADER,
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * Why: The one request function every `lib/api/*` helper uses. It sends cookies and the CSRF
 * header, retries once after a session refresh, and throws `ApiProblemError` for every failure.
 * @param path - API path starting with `/` (e.g. `/products/abc`).
 * @param options - Request options, see `ApiRequestOptions`.
 * @returns Parsed JSON body, or `null` for 204/empty responses. `T` is the caller's response
 *   shape from `@/lib/api/types`; include `null` in it for endpoints that may return no body.
 * @throws {ApiProblemError} On any non-2xx response.
 * @throws {TypeError} On network failure (mapped to a connectivity message by `toUserMessage`).
 * @example
 * const product = await apiRequest(`/products/${encodeURIComponent(id)}`);
 * await apiRequest('/me', { method: 'PATCH', body: { firstName: 'Sam' } });
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, headers, retryOnUnauthorized = true } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const requestHeaders: Record<string, string> = {
    Accept: `application/json, ${PROBLEM_CONTENT_TYPE}`,
    ...(SAFE_METHODS.has(method.toUpperCase()) ? {} : CSRF_HEADER),
    ...(headers || {}),
  };
  const init: RequestInit = { method, credentials: 'include', signal, headers: requestHeaders };
  if (body !== undefined) {
    init.body = isFormData ? body : JSON.stringify(body);
    if (!isFormData) {
      requestHeaders['Content-Type'] = 'application/json';
    }
  }

  let response = await fetch(buildUrl(path, query), init);

  if (response.status === 401 && retryOnUnauthorized) {
    const problem = await toProblemError(response.clone());
    if (problem.code === TOKEN_EXPIRED_CODE && (await refreshSession())) {
      response = await fetch(buildUrl(path, query), init);
    }
  }

  if (!response.ok) {
    throw await toProblemError(response);
  }

  if (response.status === 204) {
    return null as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
