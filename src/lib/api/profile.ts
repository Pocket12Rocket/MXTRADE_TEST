import { apiRequest } from '@/lib/apiClient';
import type { Me, UpdateMeBody } from '@/lib/api/types';

/**
 * Why: Profile calls for the signed-in user (`/v1/me/*`); each returns the updated `Me`.
 */

/**
 * Why: Uploads a new profile photo, sent as multipart in the `photo` field. The file must already
 * be a square JPEG, PNG or WebP; HEIC is not supported.
 * @param file - The cropped square image.
 * @returns The updated `Me` (with the new `photoUrl`).
 * @throws {ApiProblemError} 422 `VALIDATION_FAILED` (not an image, or smaller than 128×128);
 *   413 `PAYLOAD_TOO_LARGE` (over 10 MB).
 * @example
 * setSignedInUser(await uploadMyPhoto(croppedFile));
 */
export function uploadMyPhoto(file: File): Promise<Me> {
  const form = new FormData();
  form.append('photo', file, file.name || 'photo.webp');
  return apiRequest<Me>('/me/photo', { method: 'POST', body: form });
}

/**
 * Why: Removes the profile photo, so the header and profile fall back to initials.
 * @returns The updated `Me` (with `photoUrl` null).
 * @throws {ApiProblemError} On server errors.
 * @example
 * setSignedInUser(await removeMyPhoto());
 */
export function removeMyPhoto(): Promise<Me> {
  return apiRequest<Me>('/me/photo', { method: 'DELETE' });
}

/**
 * Why: Saves basic profile details; only the fields sent change. The phone takes 6–15 digits
 * (spaces and dashes ignored, '' clears it) and the email can't be changed here.
 * @param fields - Fields to change.
 * @param fields.firstName - First name.
 * @param fields.lastName - Last name.
 * @param fields.phone - Phone without the country code, or '' to clear it.
 * @param fields.countryCode - Dialling code such as '+27'.
 * @returns The updated `Me`.
 * @throws {ApiProblemError} 422 `VALIDATION_FAILED` with paths firstName, lastName, phone or
 *   countryCode.
 * @example
 * setSignedInUser(await updateMe({ firstName: 'Sam', phone: '82 123 4567' }));
 */
export function updateMe(fields: UpdateMeBody): Promise<Me> {
  return apiRequest<Me>('/me', { method: 'PATCH', body: fields });
}
