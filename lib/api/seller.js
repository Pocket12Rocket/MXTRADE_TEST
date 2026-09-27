import { apiRequest } from '../apiClient';

/**
 * Why: Seller application calls (`/v1/me/seller-profile`), replacing the Firestore
 * `sellerPrivateProfiles`/`sellerPublicProfiles` writes. Selling is self-service (D-03): the
 * backend's automatic ID and bank checks are the validation, and a passing application is
 * approved immediately. Only an admin can suspend or reinstate a seller; the client never sets
 * `canSell`. The ID and account numbers are stored encrypted and never returned; only their
 * last 4 digits come back.
 */

// Why: backend enum values for bank account type, with the labels shown in the form.
export const ACCOUNT_TYPE_OPTIONS = [
  { value: 'cheque', label: 'Current/Cheque' },
  { value: 'savings', label: 'Savings' },
  { value: 'transmission', label: 'Transmission' },
  { value: 'business', label: 'Business' },
];

// Why: display copy for `/me.sellerStatus`, shared by the profile page and the seller gates.
export const SELLER_STATUS_LABELS = {
  none: 'Not enabled yet',
  approved: 'Enabled',
  suspended: 'Suspended',
};

// Why: where a suspended seller is told to go (D-21: all mail is from and to support@).
export const SELLER_SUPPORT_EMAIL = 'support@fastsport.co.za';

/**
 * Why: Loads the signed-in user's seller application, treating "never applied" as a normal
 * state (`null`) rather than an error.
 * @returns {Promise<object|null>} The `SellerProfile` (status `approved`|`suspended`,
 *   suspensionReason, idNumberLast4, address and bank fields, accountLast4, submittedAt,
 *   suspendedAt), or `null` if the user has never applied.
 * @throws {ApiProblemError} On errors other than 404.
 * @example
 * const application = await fetchMySellerProfile();
 */
export async function fetchMySellerProfile() {
  try {
    return await apiRequest('/me/seller-profile');
  } catch (err) {
    if (err?.name === 'ApiProblemError' && err.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Why: Submits or updates the seller application. The backend's automatic checks validate the
 * SA ID number (13 digits and a check digit), post code (4 digits), branch code (6 digits) and
 * account number (6–16 digits). Passing checks approve the seller immediately (`canSell`
 * becomes true); failing checks store nothing. Editing never lifts a suspension.
 * @param {object} form - Application fields. The full ID and account numbers are always required.
 * @param {string} form.idNumber - SA ID number (spaces and dashes are allowed).
 * @param {string} form.streetAddress - Street address.
 * @param {string} form.suburb - Suburb.
 * @param {string} form.city - City.
 * @param {string} form.postCode - 4-digit post code.
 * @param {string} form.bankName - Bank name.
 * @param {string} form.accountType - One of `ACCOUNT_TYPE_OPTIONS` values.
 * @param {string} form.branchName - Branch name.
 * @param {string} form.branchCode - 6-digit branch code.
 * @param {string} form.accountNumber - 6–16 digit account number.
 * @returns {Promise<object>} The saved `SellerProfile` (status `approved`, or `suspended` if an
 *   admin has suspended the seller).
 * @throws {ApiProblemError} 409 `TERMS_VERSION_OUTDATED` when the current seller terms haven't been
 *   accepted; 422 `VALIDATION_FAILED` with per-field `errors[]`.
 * @example
 * const saved = await saveMySellerProfile(form);
 */
export function saveMySellerProfile(form) {
  const body = {
    idNumber: form.idNumber.trim(),
    streetAddress: form.streetAddress.trim(),
    suburb: form.suburb.trim(),
    city: form.city.trim(),
    postCode: form.postCode.trim(),
    bankName: form.bankName.trim(),
    accountType: form.accountType,
    branchName: form.branchName.trim(),
    branchCode: form.branchCode.trim(),
    accountNumber: form.accountNumber.trim(),
  };
  return apiRequest('/me/seller-profile', { method: 'PUT', body });
}
