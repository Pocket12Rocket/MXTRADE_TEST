import type { Me } from '@/lib/api/types';

/**
 * Why: Tests need a complete, valid `Me` without restating every field; they override only what
 * the case is about.
 * @param overrides - Fields to change.
 * @returns A signed-in customer.
 * @example
 * const me = makeMe({ emailVerified: false });
 */
export function makeMe(overrides: Partial<Me> = {}): Me {
  return {
    id: 'u1',
    email: 'a@b.co',
    emailVerified: true,
    role: 'customer',
    permissions: [],
    displayName: 'Sam Test',
    firstName: 'Sam',
    lastName: 'Test',
    phone: '',
    countryCode: '+27',
    photoUrl: null,
    canSell: false,
    sellerProfileComplete: false,
    sellerStatus: 'none',
    termsAcceptedVersion: null,
    sellerTermsAcceptedVersion: null,
    currentTermsVersion: '2026-08-05',
    currentSellerTermsVersion: '2026-07-01',
    termsReacceptRequired: false,
    sellerTermsReacceptRequired: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
