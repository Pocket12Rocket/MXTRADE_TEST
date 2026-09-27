import { apiRequest } from '../apiClient';

/**
 * Why: Profile calls for the signed-in user (`/v1/me/*`), replacing the Firestore
 * `users/{uid}` writes and the Firebase Storage `profilePictures/` upload. The backend stores the
 * photo as a 512×512 WebP of at most 100 KB with all metadata (including GPS) stripped, and
 * returns the updated `Me`.
 */

/**
 * Why: Uploads a new profile photo. The file must already be cropped to a square by
 * `ImageCropDialog` (JPEG, PNG or WebP; the server can't read HEIC). It's sent as multipart with
 * one file in the `photo` field, and `apiClient` leaves the Content-Type for the browser to set.
 * @param {File} file - The cropped square image.
 * @returns {Promise<object>} The updated `Me` (with the new `photoUrl`).
 * @throws {ApiProblemError} 422 `VALIDATION_FAILED` (not an image, or smaller than 128×128);
 *   413 `PAYLOAD_TOO_LARGE` (over 10 MB).
 * @example
 * setSignedInUser(await uploadMyPhoto(croppedFile));
 */
export function uploadMyPhoto(file) {
  const form = new FormData();
  form.append('photo', file, file.name || 'photo.webp');
  return apiRequest('/me/photo', { method: 'POST', body: form });
}

/**
 * Why: Removes the profile photo, so the header and profile fall back to initials.
 * @returns {Promise<object>} The updated `Me` (with `photoUrl` null).
 * @throws {ApiProblemError} On server errors.
 * @example
 * setSignedInUser(await removeMyPhoto());
 */
export function removeMyPhoto() {
  return apiRequest('/me/photo', { method: 'DELETE' });
}

/**
 * Why: Saves basic profile details. Only the fields sent change; the backend trims them,
 * normalises the phone (spaces and dashes ignored, 6–15 digits, '' clears it) and derives the
 * display name. Email can't be changed here.
 * @param {object} fields - Fields to change.
 * @param {string} [fields.firstName] - First name.
 * @param {string} [fields.lastName] - Last name.
 * @param {string} [fields.phone] - Phone without the country code, or '' to clear it.
 * @param {string} [fields.countryCode] - Dialling code such as '+27'.
 * @returns {Promise<object>} The updated `Me`.
 * @throws {ApiProblemError} 422 `VALIDATION_FAILED` with paths firstName, lastName, phone or
 *   countryCode.
 * @example
 * setSignedInUser(await updateMe({ firstName: 'Sam', phone: '82 123 4567' }));
 */
export function updateMe(fields) {
  return apiRequest('/me', { method: 'PATCH', body: fields });
}
