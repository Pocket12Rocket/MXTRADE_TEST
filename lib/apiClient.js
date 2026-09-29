/**
 * Why: The single place the client app talks to the FastSport backend API (FastSport_BackEnd),
 * which replaces direct Firebase SDK access. Centralising `fetch` here means cookie handling,
 * the one-shot session refresh on 401, and RFC 9457 `application/problem+json` parsing are
 * implemented once instead of per page or per helper (see the no-duplicate-code rule in
 * AGENTS.md). Domain helpers under `lib/api/*` call `apiRequest()`; pages never call `fetch`
 * against the backend directly.
 */

// Why: Base URL of the backend API including its version prefix (e.g.
// `http://localhost:4000/v1`). Empty string falls back to same-origin requests, which is only
// useful if the backend is reverse-proxied under the client's own domain.
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

// Why: Path of the backend's session refresh endpoint. Kept as one constant so it can be
// matched to the backend's OpenAPI contract in a single edit once that contract is published.
const REFRESH_PATH = '/auth/refresh';

const PROBLEM_CONTENT_TYPE = 'application/problem+json';

// Why: The backend's CSRF defence requires this custom header on every state-changing request;
// a custom header forces a CORS preflight, so only allowlisted origins can send it. Requests
// without it are rejected with 403 `CSRF_REJECTED`.
const CSRF_HEADER = { 'X-Requested-With': 'FastSport' };
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Why: Only this problem code means "access token expired, refresh and retry". Any other 401
// (e.g. `AUTH_UNAUTHENTICATED` when nobody is signed in) must surface as-is, not loop through
// a refresh attempt.
const TOKEN_EXPIRED_CODE = 'AUTH_TOKEN_EXPIRED';

/**
 * Why: Carries every RFC 9457 problem-details member from a failed backend response so callers
 * (and `toUserMessage()`) can branch on the stable `code`/`status` instead of parsing text, and
 * so forms can show per-field validation messages from `errors[]`.
 * @example
 * try {
 *   await apiRequest('/orders', { method: 'POST', body: payload });
 * } catch (err) {
 *   if (err instanceof ApiProblemError && err.code === 'OUT_OF_STOCK') {
 *     // show the stock conflict UI
 *   }
 * }
 */
export class ApiProblemError extends Error {
  /**
   * Why: Normalises a parsed problem document (or a synthetic one for non-problem responses)
   * into a typed error with safe defaults for every member.
   * @param {object} problem - The parsed RFC 9457 problem document.
   * @param {string} [problem.type] - URI identifying the problem type.
   * @param {string} [problem.title] - Short summary of the problem type.
   * @param {number} problem.status - HTTP status code.
   * @param {string} [problem.detail] - Occurrence-specific explanation (not rendered raw).
   * @param {string} [problem.instance] - URI identifying this occurrence.
   * @param {string} [problem.code] - Stable machine-readable error code (extension member).
   * @param {Array<{path: string, message: string}>} [problem.errors] - Field validation
   *   errors (extension member).
   * @example
   * throw new ApiProblemError({ status: 404, title: 'Not Found', code: 'PRODUCT_NOT_FOUND' });
   */
  constructor(problem) {
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
 * Why: Turns the `errors[]` extension of a validation problem into a `{ fieldPath: message }`
 * map, which is the shape the existing forms already use for inline field errors.
 * @param {*} err - A caught error; anything that is not an `ApiProblemError` yields `{}`.
 * @returns {Object<string, string>} First message per field path.
 * @example
 * const fieldErrors = getFieldErrors(err); // { 'shippingAddress.city': 'City is required' }
 */
export function getFieldErrors(err) {
  if (!(err instanceof ApiProblemError)) {
    return {};
  }

  return err.errors.reduce((acc, item) => {
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
 * @param {string} path - API path starting with `/`.
 * @param {Object<string, *>} [query] - Query params; `undefined`, `null` and `''` are skipped,
 *   arrays are repeated as `key=a&key=b`.
 * @returns {string} The full URL.
 * @example
 * buildUrl('/products', { category: 'Gear', page: 2 }); // '<base>/products?category=Gear&page=2'
 */
function buildUrl(path, query) {
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
 * Why: Converts any non-2xx response into an `ApiProblemError`. Backend errors are RFC 9457
 * problem documents; anything else (proxy error pages, gateway timeouts) becomes a synthetic
 * problem with just the status so callers still get one consistent error type.
 * @param {Response} response - The failed fetch response.
 * @returns {Promise<ApiProblemError>} The error to throw.
 * @example
 * if (!response.ok) throw await toProblemError(response);
 */
async function toProblemError(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes(PROBLEM_CONTENT_TYPE) || contentType.includes('application/json')) {
    try {
      const body = await response.json();
      return new ApiProblemError({ ...body, status: body?.status || response.status });
    } catch {
      // Fall through to the synthetic problem below when the body is not valid JSON.
    }
  }
  return new ApiProblemError({ status: response.status, title: response.statusText });
}

// Why: Single-flight guard so several requests failing with 401 at once trigger one refresh
// call, not one per request.
let refreshInFlight = null;

/**
 * Why: Asks the backend to rotate the access-token cookie using the refresh-token cookie.
 * Concurrent callers share one in-flight request.
 * @returns {Promise<boolean>} True when the session was refreshed.
 * @example
 * if (await refreshSession()) { retry(); }
 */
function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = fetch(buildUrl(REFRESH_PATH), { method: 'POST', credentials: 'include', headers: CSRF_HEADER })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * Why: The one request function every `lib/api/*` helper uses. Sends auth cookies, encodes JSON
 * or multipart bodies, adds the CSRF header to state-changing requests, retries once after a
 * session refresh when the backend reports `AUTH_TOKEN_EXPIRED`, and throws
 * `ApiProblemError` for every failure so errors flow through `toUserMessage()` uniformly.
 * @param {string} path - API path starting with `/` (e.g. `/products/abc`).
 * @param {object} [options] - Request options.
 * @param {string} [options.method='GET'] - HTTP method.
 * @param {*} [options.body] - Plain object/array (sent as JSON) or `FormData` (sent as
 *   multipart, letting the browser set the boundary).
 * @param {Object<string, *>} [options.query] - Query params, see `buildUrl`.
 * @param {AbortSignal} [options.signal] - Optional abort signal for timeouts/unmounts.
 * @param {Object<string, string>} [options.headers] - Extra request headers merged over the
 *   defaults (e.g. `X-Order-Token` for guest order access).
 * @param {boolean} [options.retryOnUnauthorized=true] - Set false for auth endpoints (login,
 *   refresh) where a 401 must not trigger a refresh loop.
 * @returns {Promise<*>} Parsed JSON body, or `null` for 204/empty responses.
 * @throws {ApiProblemError} On any non-2xx response.
 * @throws {TypeError} On network failure (mapped to a connectivity message by `toUserMessage`).
 * @example
 * const product = await apiRequest(`/products/${encodeURIComponent(id)}`);
 * await apiRequest('/me', { method: 'PATCH', body: { firstName: 'Sam' } });
 */
export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, query, signal, headers, retryOnUnauthorized = true } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const init = {
    method,
    credentials: 'include',
    signal,
    headers: {
      Accept: `application/json, ${PROBLEM_CONTENT_TYPE}`,
      ...(SAFE_METHODS.has(method.toUpperCase()) ? {} : CSRF_HEADER),
      ...(headers || {}),
    },
  };
  if (body !== undefined) {
    init.body = isFormData ? body : JSON.stringify(body);
    if (!isFormData) {
      init.headers['Content-Type'] = 'application/json';
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
    return null;
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
