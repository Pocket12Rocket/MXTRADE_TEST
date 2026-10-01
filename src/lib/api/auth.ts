import { API_BASE_URL, apiRequest, isApiProblem } from '@/lib/apiClient';
import type { ApiRequestOptions } from '@/lib/apiClient';
import type { AcceptTermsBody, Me, MessageResponse, RegisterBody } from '@/lib/api/types';

/**
 * Why: Auth calls against the FastSport backend (`/v1/auth/*`, `/v1/me`). The session lives in
 * httpOnly cookies, so none of these return or store tokens.
 */

const NO_REFRESH: ApiRequestOptions = { retryOnUnauthorized: false };

/** Registration details; `phone` and `countryCode` are optional (the backend defaults them). */
export type RegisterInput = Omit<RegisterBody, 'phone' | 'countryCode' | 'acceptTerms'> &
  Partial<Pick<RegisterBody, 'phone' | 'countryCode'>>;

/**
 * Why: Creates an account; the backend emails a verification link and answers the same way
 * whether or not the email already exists (no account enumeration).
 * @param input - Registration details.
 * @param input.email - Email address.
 * @param input.password - Password (8–128 characters).
 * @param input.firstName - First name.
 * @param input.lastName - Last name.
 * @param input.phone - Phone number without country code.
 * @param input.countryCode - Dialling code, defaults to +27 on the backend.
 * @returns Generic confirmation.
 * @throws {ApiProblemError} 422 `VALIDATION_FAILED` with per-field `errors[]`.
 * @example
 * await register({ email, password, firstName, lastName, phone, countryCode });
 */
export function register({
  email,
  password,
  firstName,
  lastName,
  phone,
  countryCode,
}: RegisterInput): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/auth/register', {
    method: 'POST',
    body: {
      email,
      password,
      firstName,
      lastName,
      ...(phone ? { phone } : {}),
      ...(countryCode ? { countryCode } : {}),
    },
    ...NO_REFRESH,
  });
}

/**
 * Why: Signs in with email and password; on success the backend sets the session cookies and
 * returns the signed-in user.
 * @param email - Email address.
 * @param password - Password.
 * @returns The `Me` object.
 * @throws {ApiProblemError} 401 `AUTH_INVALID_CREDENTIALS`, 403 `AUTH_EMAIL_NOT_VERIFIED`.
 * @example
 * const me = await login('sam@example.com', 'secret123');
 */
export function login(email: string, password: string): Promise<Me> {
  return apiRequest<Me>('/auth/login', {
    method: 'POST',
    body: { email, password },
    ...NO_REFRESH,
  });
}

/**
 * Why: Ends the session on the backend (clears cookies, revokes the refresh token). Works even
 * when the access token has expired.
 * @throws {ApiProblemError} Only on unexpected server errors.
 * @example
 * await logout();
 */
export function logout(): Promise<null> {
  return apiRequest<null>('/auth/logout', { method: 'POST', ...NO_REFRESH });
}

/**
 * Why: Loads the signed-in user, or `null` when nobody is signed in, so the auth context can
 * treat "signed out" as a normal state rather than an error.
 * @returns The `Me` object, or `null` when signed out.
 * @throws {ApiProblemError} On anything other than a signed-out 401.
 * @example
 * const me = await getMe();
 */
export async function getMe(): Promise<Me | null> {
  try {
    return await apiRequest<Me>('/me');
  } catch (err) {
    if (isApiProblem(err, 401)) {
      return null;
    }
    throw err;
  }
}

/**
 * Why: Confirms the email from the link in the verification email. Does not sign the user in.
 * @param token - The `token` query value from the link.
 * @throws {ApiProblemError} 400 `AUTH_TOKEN_INVALID` when used or expired.
 * @example
 * await verifyEmail(router.query.token);
 */
export function verifyEmail(token: string): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/auth/verify-email', {
    method: 'POST',
    body: { token },
    ...NO_REFRESH,
  });
}

/**
 * Why: Sends a fresh verification link; always answers the same way (no account enumeration).
 * @param email - Email address.
 * @throws {ApiProblemError} 429 `RATE_LIMITED`.
 * @example
 * await resendVerification(email);
 */
export function resendVerification(email: string): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/auth/verify-email/resend', {
    method: 'POST',
    body: { email },
    ...NO_REFRESH,
  });
}

/**
 * Why: Starts a password reset; the backend emails a link to `/reset-password?token=` and
 * always answers the same way.
 * @param email - Email address.
 * @throws {ApiProblemError} 429 `RATE_LIMITED`.
 * @example
 * await forgotPassword(email);
 */
export function forgotPassword(email: string): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/auth/password/forgot', {
    method: 'POST',
    body: { email },
    ...NO_REFRESH,
  });
}

/**
 * Why: Sets a new password from the reset link; the backend signs out every device, so the user
 * signs in again afterwards.
 * @param token - The `token` query value from the link.
 * @param password - The new password (8–128 characters).
 * @throws {ApiProblemError} 400 `AUTH_TOKEN_INVALID`, 422 `VALIDATION_FAILED`.
 * @example
 * await resetPassword(token, newPassword);
 */
export function resetPassword(token: string, password: string): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/auth/password/reset', {
    method: 'POST',
    body: { token, password },
    ...NO_REFRESH,
  });
}

/**
 * Why: Records acceptance of the buyer terms version the user was shown.
 * @param version - The displayed version (see `features/auth/termsVersions.ts`).
 * @returns The updated `Me` object.
 * @throws {ApiProblemError} 409 `TERMS_VERSION_OUTDATED`.
 * @example
 * const me = await acceptTerms(BUYER_TERMS_VERSION);
 */
export function acceptTerms(version: AcceptTermsBody['version']): Promise<Me> {
  return apiRequest<Me>('/me/terms/accept', { method: 'POST', body: { version } });
}

/**
 * Why: Records acceptance of the seller terms version the user was shown.
 * @param version - The displayed version (see `features/auth/termsVersions.ts`).
 * @returns The updated `Me` object.
 * @throws {ApiProblemError} 409 `TERMS_VERSION_OUTDATED`.
 * @example
 * const me = await acceptSellerTerms(SELLER_TERMS_VERSION);
 */
export function acceptSellerTerms(version: AcceptTermsBody['version']): Promise<Me> {
  return apiRequest<Me>('/me/seller-terms/accept', { method: 'POST', body: { version } });
}

/**
 * Why: Google sign-in is a full-page redirect through the backend (state + PKCE), not a fetch.
 * `returnTo` must be a relative path or the backend rejects it.
 * @param returnTo - Client path to land on after sign-in.
 * @returns The URL to navigate the browser to.
 * @example
 * window.location.assign(getGoogleSignInUrl('/profile'));
 */
export function getGoogleSignInUrl(returnTo: string = '/'): string {
  const safeReturnTo =
    typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : '/';
  const params = new URLSearchParams({ app: 'client', returnTo: safeReturnTo });
  return `${API_BASE_URL}/auth/google?${params.toString()}`;
}
