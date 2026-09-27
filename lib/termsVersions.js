/**
 * Why: The terms versions this client *displays* in `TermsAndConditionsModal`. The backend
 * requires the accepted version to match the one shown (it answers 409 `TERMS_VERSION_OUTDATED`
 * otherwise), so these must be bumped together with the modal copy whenever the terms change,
 * and must match the backend's `currentTermsVersion` / `currentSellerTermsVersion`.
 */
export const BUYER_TERMS_VERSION = '2026-08-05';
export const SELLER_TERMS_VERSION = '2026-07-01';
