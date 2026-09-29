/**
 * Why: Central place to turn a caught error into a short, plain sentence a shopper/seller/admin
 * can act on, per AGENTS.md's "User-facing errors" rule (never render `err.message`, an API
 * error code, stack text, or a console/index-building URL in the UI). Tracked as ARCH-14 in
 * docs/TECH_DEBT.md. Every page/component that shows an error to a user should route through
 * `toUserMessage()` (or throw a `UserFacingError` for its own validation copy) instead of
 * inlining a fallback string and hoping nothing raw leaks through.
 */

/**
 * Why: Lets code that writes its own end-user-facing copy (form validation, business-rule
 * messages such as "Description must be 75 characters or fewer") mark that message as safe to
 * render as-is, so `toUserMessage()` can tell it apart from a raw system or API error message
 * that must never reach the UI unmapped.
 * @example
 * if (!description.trim()) {
 *   throw new UserFacingError('Please enter a description.');
 * }
 */
export class UserFacingError extends Error {
  /**
   * Why: Sets `isUserFacing = true` so `toUserMessage()` (and any other call site) can detect
   * this error by duck-typing alone, without needing an `instanceof` check across module
   * boundaries (e.g. after Next.js Fast Refresh reloads a module).
   * @param {string} message - The exact sentence to show the user, already in plain language.
   * @example
   * throw new UserFacingError('Please upload at least one product image.');
   */
  constructor(message) {
    super(message);
    this.name = 'UserFacingError';
    this.isUserFacing = true;
  }
}

/**
 * Why: Detects a connectivity failure (offline, DNS, CORS or a refused connection), which
 * `fetch()` reports as a `TypeError` rather than an HTTP response, so it maps to one friendly
 * "check your connection" sentence.
 * @param {*} err - The caught error/rejection value.
 * @returns {boolean} True when this looks like a connectivity failure rather than a server reply.
 * @example
 * isNetworkError(new TypeError('Failed to fetch')); // true
 */
function isNetworkError(err) {
  const message = String(err?.message || '').toLowerCase();
  return message.includes('failed to fetch') || message.includes('network error') || message.includes('network request failed');
}

// Why: Fallback sentences for backend RFC 9457 problems keyed by HTTP status, used when a 4xx
// problem carries no `detail` (which the backend guarantees is user-safe) or for 5xx problems,
// whose text is never shown. `title` is never rendered. Specific backend `code` values can be
// added to PROBLEM_CODE_MESSAGES to override the backend's wording where needed.
const PROBLEM_STATUS_MESSAGES = {
  401: 'Please sign in to continue.',
  403: "You don't have permission to do that.",
  404: "We couldn't find that item.",
  409: 'This changed while you were working on it. Please refresh and try again.',
  413: 'That file is too large. Please choose a smaller image.',
  429: 'Too many requests right now. Please wait a moment.',
};
const PROBLEM_CODE_MESSAGES = {
  AUTH_EMAIL_NOT_VERIFIED: 'Please verify your email address first. Check your inbox for the verification link.',
  SELLER_NOT_APPROVED: 'Your account is not approved for selling yet. Complete your seller details in your profile first.',
  TERMS_VERSION_OUTDATED: 'The terms have changed. Please accept the latest terms in your profile, then try again.',
  LISTING_EDIT_PENDING: 'This listing already has an edit waiting for approval. Please wait for a decision before editing it again.',
  SUBMISSION_NOT_EDITABLE: 'This listing can no longer be changed.',
};

/**
 * Why: Maps an `ApiProblemError` (from `lib/apiClient.js`) to a plain sentence: a known backend
 * `code` override wins, then the backend's user-safe `detail` (4xx only), then the HTTP status,
 * then the caller's action-specific fallback. Per-field validation messages are shown inline
 * via `getFieldErrors()`.
 * @param {{code: string, status: number, detail: string}} err - The problem error.
 * @param {string} fallback - Action-specific sentence from the caller.
 * @returns {string} A short, plain-language sentence safe to render.
 * @example
 * problemMessage({ code: '', status: 429 }, 'Could not save.'); // 'Too many requests right now...'
 */
function problemMessage(err, fallback) {
  if (err.code && PROBLEM_CODE_MESSAGES[err.code]) {
    return PROBLEM_CODE_MESSAGES[err.code];
  }
  // Why: The backend contract guarantees `detail` is written for end users on 4xx problems.
  if (err.detail && err.status >= 400 && err.status < 500) {
    return err.detail;
  }
  if (PROBLEM_STATUS_MESSAGES[err.status]) {
    return PROBLEM_STATUS_MESSAGES[err.status];
  }
  if (err.status >= 500) {
    return 'Something went wrong on our side. Please try again in a moment.';
  }
  return fallback;
}

/**
 * Why: The single conversion point from "whatever we caught" to "what we show the user",
 * required by AGENTS.md so no page has to hand-roll its own error-to-sentence mapping
 * (and so none of them accidentally render `err.message` again). Call sites pass a fallback
 * tailored to the action that failed (e.g. "We couldn't load your orders. Please try again.")
 * for any error shape this function doesn't recognise.
 * @param {*} err - The caught error/rejection value. May be a `UserFacingError`, an
 *   `ApiProblemError` (from lib/apiClient.js), a network `TypeError`, a plain `Error`, or anything else.
 * @param {string} fallback - The friendly sentence to show when `err` isn't a recognised,
 *   user-facing shape. Should be specific to the action that failed, not a generic "Something
 *   went wrong."
 * @returns {string} A short, plain-language sentence safe to render directly in the UI.
 * @example
 * try {
 *   await fetchUserOrders(user.email);
 * } catch (err) {
 *   setError(toUserMessage(err, "We couldn't load your orders. Please try again."));
 * }
 */
export function toUserMessage(err, fallback) {
  // Why: never log a user/profile object here — only the error code or message, per AGENTS.md's
  // "never log user or profile objects" rule.
  console.error('[userMessage]', err?.code || err?.message || err);

  if (err?.isUserFacing || err instanceof UserFacingError) {
    return err.message;
  }

  if (err?.name === 'ApiProblemError') {
    return problemMessage(err, fallback);
  }

  if (isNetworkError(err)) {
    return "We couldn't reach the server. Check your connection and try again.";
  }

  return fallback;
}

/**
 * Why: For call sites that only need the error logged (no message shown, e.g. a best-effort
 * background write) — keeps the same "never log user/profile objects, only code/message"
 * discipline as `toUserMessage()` without forcing every caller to build a UI string.
 * @param {string} area - A short tag identifying where the error happened (e.g. 'checkout',
 *   'admin-notifications'), printed as `[area]` to match this repo's existing console.error
 *   convention.
 * @param {*} err - The caught error/rejection value.
 * @returns {void}
 * @example
 * markAdminNotificationsRead().catch((err) => reportError('admin-notifications', err));
 */
export function reportError(area, err) {
  console.error(`[${area}]`, err?.code || err?.message || err);
}
