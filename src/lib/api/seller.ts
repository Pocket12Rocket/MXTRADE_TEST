import { apiRequest, isApiProblem } from '@/lib/apiClient';
import type {
  BankAccountType,
  SellerProfile,
  SellerStatus,
  UpsertSellerProfileBody,
} from '@/lib/api/types';

/**
 * Why: Seller application calls (`/v1/me/seller-profile`). The ID and account numbers are never
 * returned; only their last 4 digits come back.
 */

// Why: backend enum values for bank account type, with the labels shown in the form.
export const ACCOUNT_TYPE_OPTIONS: Array<{ value: BankAccountType; label: string }> = [
  { value: 'cheque', label: 'Current/Cheque' },
  { value: 'savings', label: 'Savings' },
  { value: 'transmission', label: 'Transmission' },
  { value: 'business', label: 'Business' },
];

// Why: display copy for `/me.sellerStatus`, shared by the profile page and the seller gates.
export const SELLER_STATUS_LABELS: Record<SellerStatus | 'none', string> = {
  none: 'Not enabled yet',
  approved: 'Enabled',
  suspended: 'Suspended',
};

// Why: where a suspended seller is told to go (support@ is the contact address).
export const SELLER_SUPPORT_EMAIL = 'support@fastsport.co.za';

/** The seller application form's values; text fields are trimmed on save. */
export type SellerProfileForm = UpsertSellerProfileBody;

/**
 * Why: Loads the signed-in user's seller application, treating "never applied" as a normal
 * state (`null`) rather than an error.
 * @returns The `SellerProfile` (status `approved`|`suspended`,
 *   suspensionReason, idNumberLast4, address and bank fields, accountLast4, submittedAt,
 *   suspendedAt), or `null` if the user has never applied.
 * @throws {ApiProblemError} On errors other than 404.
 * @example
 * const application = await fetchMySellerProfile();
 */
export async function fetchMySellerProfile(): Promise<SellerProfile | null> {
  try {
    return await apiRequest<SellerProfile>('/me/seller-profile');
  } catch (err) {
    if (isApiProblem(err, 404)) {
      return null;
    }
    throw err;
  }
}

/**
 * Why: Submits or updates the seller application. The backend validates the SA ID number (13
 * digits and a check digit), post code (4 digits), branch code (6 digits) and account number
 * (6–16 digits).
 * @param form - Application fields. The full ID and account numbers are always required.
 * @param form.idNumber - SA ID number (spaces and dashes are allowed).
 * @param form.streetAddress - Street address.
 * @param form.suburb - Suburb.
 * @param form.city - City.
 * @param form.postCode - 4-digit post code.
 * @param form.bankName - Bank name.
 * @param form.accountType - One of `ACCOUNT_TYPE_OPTIONS` values.
 * @param form.branchName - Branch name.
 * @param form.branchCode - 6-digit branch code.
 * @param form.accountNumber - 6–16 digit account number.
 * @returns The saved `SellerProfile` (status `approved`, or `suspended` if an
 *   admin has suspended the seller).
 * @throws {ApiProblemError} 409 `TERMS_VERSION_OUTDATED` when the current seller terms haven't been
 *   accepted; 422 `VALIDATION_FAILED` with per-field `errors[]`.
 * @example
 * const saved = await saveMySellerProfile(form);
 */
export function saveMySellerProfile(form: SellerProfileForm): Promise<SellerProfile> {
  const body: UpsertSellerProfileBody = {
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
  return apiRequest<SellerProfile>('/me/seller-profile', { method: 'PUT', body });
}
