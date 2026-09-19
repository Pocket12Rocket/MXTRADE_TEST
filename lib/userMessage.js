/**
 * Why: Central place to turn a caught error into a short, plain sentence a shopper/seller/admin
 * can act on, per AGENTS.md's "User-facing errors" rule (never render `err.message`, a Firebase
 * error code, stack text, or a console/index-building URL in the UI). Tracked as ARCH-14 in
 * docs/TECH_DEBT.md. Every page/component that shows an error to a user should route through
 * `toUserMessage()` (or throw a `UserFacingError` for its own validation copy) instead of
 * inlining a fallback string and hoping nothing raw leaks through.
 */

/**
 * Why: Lets code that writes its own end-user-facing copy (form validation, business-rule
 * messages such as "Description must be 75 characters or fewer") mark that message as safe to
 * render as-is, so `toUserMessage()` can tell it apart from a raw Firebase/system error message
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

// Why: Common Firebase Auth error codes mapped to short, specific sentences instead of the raw
// "auth/wrong-password" style code. Newer Firebase Auth versions collapse wrong-password and
// user-not-found into 'auth/invalid-credential' for security reasons, so both are covered.
const AUTH_CODE_MESSAGES = {
  'auth/wrong-password': "That email or password doesn't look right. Please check and try again.",
  'auth/invalid-credential': "That email or password doesn't look right. Please check and try again.",
  'auth/user-not-found': "We couldn't find an account with that email.",
  'auth/email-already-in-use': 'An account with that email already exists.',
  'auth/weak-password': 'Please choose a stronger password (at least 6 characters).',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/invalid-email': "That doesn't look like a valid email address.",
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/network-request-failed': "We couldn't reach the server. Check your connection and try again.",
  'auth/popup-closed-by-user': 'Sign-in was cancelled before it finished. Please try again.',
  'auth/requires-recent-login': 'Please sign in again to continue.',
};

/**
 * Why: Detects a network-shaped failure (offline, timed out, DNS/fetch failure) across the
 * different error shapes this app can throw — a Firestore/Storage `FirebaseError` with a
 * `code`, or a plain `TypeError` from a failed `fetch()` call in an API route wrapper — so both
 * map to the same friendly "check your connection" sentence.
 * @param {*} err - The caught error/rejection value.
 * @returns {boolean} True when this looks like a connectivity failure rather than a real
 *   server-side rejection.
 */
function isNetworkError(err) {
  const code = String(err?.code || '').toLowerCase();
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'auth/network-request-failed') {
    return true;
  }

  const message = String(err?.message || '').toLowerCase();
  return message.includes('failed to fetch') || message.includes('network error') || message.includes('network request failed');
}

/**
 * Why: The single conversion point from "whatever we caught" to "what we show the user",
 * required by AGENTS.md so no page has to hand-roll its own Firebase-code-to-sentence mapping
 * (and so none of them accidentally render `err.message` again). Call sites pass a fallback
 * tailored to the action that failed (e.g. "We couldn't load your orders. Please try again.")
 * for any error shape this function doesn't recognise.
 * @param {*} err - The caught error/rejection value. May be a `UserFacingError`, a Firebase
 *   `FirebaseError` (has `.code`), a plain `Error`, or something non-Error entirely.
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

  const code = String(err?.code || '');

  if (isNetworkError(err)) {
    return "We couldn't reach the server. Check your connection and try again.";
  }

  if (code === 'permission-denied') {
    return "You don't have permission to do that.";
  }

  if (code === 'failed-precondition') {
    return "This page isn't ready yet. Please try again in a few minutes.";
  }

  if (code === 'not-found') {
    return "We couldn't find that item.";
  }

  if (code === 'resource-exhausted') {
    return 'Too many requests right now. Please wait a moment.';
  }

  if (code === 'unauthenticated') {
    return 'Please sign in to continue.';
  }

  if (code.startsWith('auth/')) {
    return AUTH_CODE_MESSAGES[code] || 'Something went wrong signing you in. Please try again.';
  }

  if (code.startsWith('storage/')) {
    return "We couldn't upload the image. Please try again.";
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
