import { API_BASE_URL, apiRequest } from '../apiClient';

/**
 * Why: Auth calls against the FastSport backend (`/v1/auth/*`, `/v1/me`), replacing the Firebase
 * Auth SDK. The session lives in httpOnly cookies set by the backend, so none of these return or
 * store tokens; they return the backend's `Me` object or nothing. Auth endpoints pass
 * `retryOnUnauthorized: false` so a 401 (wrong password, signed out) never triggers a refresh.
 */

const NO_REFRESH = { retryOnUnauthorized: false };

/**
 * Why: Creates an account; the backend emails a verification link and answers the same way
 * whether or not the email already exists (no account enumeration).
 * @param {object} input - Registration details.
 * @param {string} input.email - Email address.
 * @param {string} input.password - Password (8–128 characters).
 * @param {string} input.firstName - First name.
 * @param {string} input.lastName - Last name.
 * @param {string} [input.phone] - Phone number without country code.
 * @param {string} [input.countryCode] - Dialling code, defaults to +27 on the backend.
 * @returns {Promise<{message: string}>} Generic confirmation.
 * @throws {ApiProblemError} 422 `VALIDATION_FAILED` with per-field `errors[]`.
 * @example
 * await register({ email, password, firstName, lastName, phone, countryCode });
 */
export function register({ email, password, firstName, lastName, phone, countryCode }) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: {
      email,
      password,
      firstName,
      lastName,
      ...(phone ? { phone } : {}),
      ...(countryCode ? { countryCode } : {}),
      acceptTerms: true,
    },
    ...NO_REFRESH,
  });
}

/**
 * Why: Signs in with email and password; on success the backend sets the session cookies and
 * returns the signed-in user.
 * @param {string} email - Email address.
 * @param {string} password - Password.
 * @returns {Promise<object>} The `Me` object.
 * @throws {ApiProblemError} 401 `AUTH_INVALID_CREDENTIALS`, 403 `AUTH_EMAIL_NOT_VERIFIED`.
 * @example
 * const me = await login('sam@example.com', 'secret123');
 */
export function login(email, password) {
  return apiRequest('/auth/login', { method: 'POST', body: { email, password }, ...NO_REFRESH });
}

/**
 * Why: Ends the session on the backend (clears cookies, revokes the refresh token). Works even
 * when the access token has expired.
 * @returns {Promise<null>}
 * @throws {ApiProblemError} Only on unexpected server errors.
 * @example
 * await logout();
 */
export function logout() {
  return apiRequest('/auth/logout', { method: 'POST', ...NO_REFRESH });
}

/**
 * Why: Loads the signed-in user, or `null` when nobody is signed in, so the auth context can
 * treat "signed out" as a normal state rather than an error.
 * @returns {Promise<object|null>} The `Me` object, or `null` when signed out.
 * @throws {ApiProblemError} On anything other than a signed-out 401.
 * @example
 * const me = await getMe();
 */
export async function getMe() {
  try {
    return await apiRequest('/me');
  } catch (err) {
    if (err?.name === 'ApiProblemError' && err.status === 401) {
      return null;
    }
    throw err;
  }
}

/**
 * Why: Confirms the email from the link in the verification email. Does not sign the user in.
 * @param {string} token - The `token` query value from the link.
 * @returns {Promise<{message: string}>}
 * @throws {ApiProblemError} 400 `AUTH_TOKEN_INVALID` when used or expired.
 * @example
 * await verifyEmail(router.query.token);
 */
export function verifyEmail(token) {
  return apiRequest('/auth/verify-email', { method: 'POST', body: { token }, ...NO_REFRESH });
}

/**
 * Why: Sends a fresh verification link; always answers the same way (no account enumeration).
 * @param {string} email - Email address.
 * @returns {Promise<{message: string}>}
 * @throws {ApiProblemError} 429 `RATE_LIMITED`.
 * @example
 * await resendVerification(email);
 */
export function resendVerification(email) {
  return apiRequest('/auth/verify-email/resend', { method: 'POST', body: { email }, ...NO_REFRESH });
}

/**
 * Why: Starts a password reset; the backend emails a link to `/reset-password?token=` and
 * always answers the same way (D-15).
 * @param {string} email - Email address.
 * @returns {Promise<{message: string}>}
 * @throws {ApiProblemError} 429 `RATE_LIMITED`.
 * @example
 * await forgotPassword(email);
 */
export function forgotPassword(email) {
  return apiRequest('/auth/password/forgot', { method: 'POST', body: { email }, ...NO_REFRESH });
}

/**
 * Why: Sets a new password from the reset link; the backend signs out every device, so the user
 * signs in again afterwards.
 * @param {string} token - The `token` query value from the link.
 * @param {string} password - The new password (8–128 characters).
 * @returns {Promise<{message: string}>}
 * @throws {ApiProblemError} 400 `AUTH_TOKEN_INVALID`, 422 `VALIDATION_FAILED`.
 * @example
 * await resetPassword(token, newPassword);
 */
export function resetPassword(token, password) {
  return apiRequest('/auth/password/reset', { method: 'POST', body: { token, password }, ...NO_REFRESH });
}

/**
 * Why: Records acceptance of the buyer terms version the user was shown.
 * @param {string} version - The displayed version (see `lib/termsVersions.js`).
 * @returns {Promise<object>} The updated `Me` object.
 * @throws {ApiProblemError} 409 `TERMS_VERSION_OUTDATED`.
 * @example
 * const me = await acceptTerms(BUYER_TERMS_VERSION);
 */
export function acceptTerms(version) {
  return apiRequest('/me/terms/accept', { method: 'POST', body: { version } });
}

/**
 * Why: Records acceptance of the seller terms version the user was shown.
 * @param {string} version - The displayed version (see `lib/termsVersions.js`).
 * @returns {Promise<object>} The updated `Me` object.
 * @throws {ApiProblemError} 409 `TERMS_VERSION_OUTDATED`.
 * @example
 * const me = await acceptSellerTerms(SELLER_TERMS_VERSION);
 */
export function acceptSellerTerms(version) {
  return apiRequest('/me/seller-terms/accept', { method: 'POST', body: { version } });
}

/**
 * Why: Google sign-in is a full-page redirect through the backend (state + PKCE), not a fetch.
 * `returnTo` must be a relative path or the backend rejects it.
 * @param {string} [returnTo='/'] - Client path to land on after sign-in.
 * @returns {string} The URL to navigate the browser to.
 * @example
 * window.location.assign(getGoogleSignInUrl('/profile'));
 */
export function getGoogleSignInUrl(returnTo = '/') {
  const safeReturnTo = typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  const params = new URLSearchParams({ app: 'client', returnTo: safeReturnTo });
  return `${API_BASE_URL}/auth/google?${params.toString()}`;
}
