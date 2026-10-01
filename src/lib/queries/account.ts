import { useMutation, useQueryClient } from '@tanstack/react-query';
import { acceptSellerTerms, acceptTerms } from '@/lib/api/auth';
import { sendContactMessage } from '@/lib/api/contact';
import { removeMyPhoto, updateMe, uploadMyPhoto } from '@/lib/api/profile';
import type { AcceptTermsBody, ContactBody, Me, UpdateMeBody } from '@/lib/api/types';
import { useAuthContext } from '@/lib/AuthContext';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Why: Every account mutation returns the updated `Me`, which must reach both the shared auth
 * context (what pages read today) and the `me` query cache, so neither goes stale.
 * @returns A function that stores a fresh `Me`.
 * @example
 * const storeMe = useStoreMe();
 */
function useStoreMe() {
  const client = useQueryClient();
  const { setSignedInUser } = useAuthContext();
  return (me: Me): void => {
    setSignedInUser(me);
    client.setQueryData(queryKeys.me, me);
  };
}

/**
 * Why: Saves profile details.
 * @returns A mutation taking the changed fields.
 * @example
 * const { mutateAsync } = useUpdateMe();
 * await run(() => mutateAsync({ firstName: 'Jane' }));
 */
export function useUpdateMe() {
  const storeMe = useStoreMe();
  return useMutation({
    mutationFn: (fields: UpdateMeBody) => updateMe(fields),
    onSuccess: storeMe,
  });
}

/**
 * Why: Uploads a new cropped profile photo.
 * @returns A mutation taking the square image file.
 * @example
 * const { mutateAsync } = useUploadPhoto();
 * await run(() => mutateAsync(croppedFile));
 */
export function useUploadPhoto() {
  const storeMe = useStoreMe();
  return useMutation({ mutationFn: (file: File) => uploadMyPhoto(file), onSuccess: storeMe });
}

/**
 * Why: Removes the profile photo.
 * @returns A mutation with no arguments.
 * @example
 * const { mutateAsync } = useRemovePhoto();
 * await run(() => mutateAsync());
 */
export function useRemovePhoto() {
  const storeMe = useStoreMe();
  return useMutation({ mutationFn: () => removeMyPhoto(), onSuccess: storeMe });
}

/**
 * Why: Records acceptance of the buyer terms version the user was shown.
 * @returns A mutation taking the terms version.
 * @example
 * const { mutateAsync } = useAcceptTerms();
 * await run(() => mutateAsync(TERMS_VERSION));
 */
export function useAcceptTerms() {
  const storeMe = useStoreMe();
  return useMutation({
    mutationFn: (version: AcceptTermsBody['version']) => acceptTerms(version),
    onSuccess: storeMe,
  });
}

/**
 * Why: Records acceptance of the seller terms version the user was shown.
 * @returns A mutation taking the terms version.
 * @example
 * const { mutateAsync } = useAcceptSellerTerms();
 * await run(() => mutateAsync(SELLER_TERMS_VERSION));
 */
export function useAcceptSellerTerms() {
  const storeMe = useStoreMe();
  return useMutation({
    mutationFn: (version: AcceptTermsBody['version']) => acceptSellerTerms(version),
    onSuccess: storeMe,
  });
}

/**
 * Why: Sends the contact form to the backend, which emails the team.
 * @returns A mutation taking `{ name, email, message }`.
 * @example
 * const { mutateAsync } = useSendContact();
 * await run(() => mutateAsync({ name, email, message }));
 */
export function useSendContact() {
  return useMutation({ mutationFn: (body: ContactBody) => sendContactMessage(body) });
}
