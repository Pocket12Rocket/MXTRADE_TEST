import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMySellerProfile, saveMySellerProfile } from '@/lib/api/seller';
import type { SellerProfileForm } from '@/lib/api/seller';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Why: Seller pages gate on the seller profile and its approval status; `null` means no profile yet.
 * @returns The seller profile query.
 * @example
 * const { data: sellerProfile } = useMySellerProfile();
 */
export function useMySellerProfile() {
  return useQuery({ queryKey: queryKeys.sellerProfile, queryFn: fetchMySellerProfile });
}

/**
 * Why: Saving the seller application returns the stored profile, so the cache is replaced rather
 * than refetched.
 * @returns A mutation taking the seller profile form.
 * @example
 * const { mutateAsync } = useSaveSellerProfile();
 * await run(() => mutateAsync(form));
 */
export function useSaveSellerProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (form: SellerProfileForm) => saveMySellerProfile(form),
    onSuccess: (profile) => client.setQueryData(queryKeys.sellerProfile, profile),
  });
}
