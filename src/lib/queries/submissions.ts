import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randsToCents } from '@/lib/api/catalog';
import {
  createSubmission,
  deleteSubmission,
  editLiveProduct,
  fetchProductForEdit,
  fetchServiceFeeQuote,
  getMySubmission,
  listMyProducts,
  listMySubmissions,
  removeMyProduct,
  updateSubmission,
} from '@/lib/api/submissions';
import type { SubmissionPayload } from '@/lib/api/submissions';
import type { SubmissionStatus } from '@/lib/api/types';
import { cursorPaging } from '@/lib/queries/pagination';
import { queryKeys } from '@/lib/queryKeys';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

// Why: wait for the seller to stop typing before asking the backend, so one price does not cost
// one request per keystroke.
export const SERVICE_FEE_QUOTE_DEBOUNCE_MS = 400;

/** The request parts of a listing create or edit. */
interface ListingRequest {
  input: SubmissionPayload;
  files: File[];
}

/**
 * Why: The seller's submissions list, optionally narrowed to one review status.
 * @param status - Optional status filter; a change starts a new list.
 * @param limit - Optional page size.
 * @returns The infinite query of listings.
 * @example
 * const { data, fetchNextPage } = useMySubmissions('pending_review');
 */
export function useMySubmissions(status?: SubmissionStatus, limit?: number) {
  return useInfiniteQuery({
    queryKey: queryKeys.submissions.list(status),
    queryFn: ({ pageParam }) => listMySubmissions({ status, cursor: pageParam, limit }),
    ...cursorPaging,
  });
}

/**
 * Why: Editing a submission starts from its current values.
 * @param id - Submission UUID; nothing is fetched while empty.
 * @returns The submission query.
 * @example
 * const { data: listing } = useMySubmission(id);
 */
export function useMySubmission(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.submissions.detail(id ?? ''),
    queryFn: () => getMySubmission(id as string),
    enabled: Boolean(id),
  });
}

/**
 * Why: The seller's live products list.
 * @param limit - Optional page size.
 * @returns The infinite query of live products.
 * @example
 * const { data, fetchNextPage } = useMyProducts();
 */
export function useMyProducts(limit?: number) {
  return useInfiniteQuery({
    queryKey: queryKeys.myProducts.list,
    queryFn: ({ pageParam }) => listMyProducts({ cursor: pageParam, limit }),
    ...cursorPaging,
  });
}

/**
 * Why: Editing a live product starts from its current values.
 * @param id - Product UUID; nothing is fetched while empty.
 * @returns The seller's view of the product.
 * @example
 * const { data: listing } = useMyProduct(id);
 */
export function useMyProduct(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.myProducts.detail(id ?? ''),
    queryFn: () => fetchProductForEdit(id as string),
    enabled: Boolean(id),
  });
}

/**
 * Why: Powers the live "buyers pay R..." preview on the seller forms. The backend owns the fee
 * rules, so it is asked after a short pause in typing instead of calculated on the client.
 * @param price - The seller's own price in rands, as typed.
 * @returns The query; `data` is undefined while the price is empty or invalid.
 * @example
 * const { data: quote } = useServiceFeeQuote(form.price);
 */
export function useServiceFeeQuote(price: string | number) {
  const cents = randsToCents(useDebouncedValue(price, SERVICE_FEE_QUOTE_DEBOUNCE_MS));
  const valid = Number.isFinite(cents) && cents > 0;
  return useQuery({
    queryKey: queryKeys.serviceFeeQuote(valid ? cents : 0),
    queryFn: () => fetchServiceFeeQuote(cents),
    enabled: valid,
    // Why: the preview is a convenience and the backend prices the listing on submit anyway.
    retry: false,
  });
}

/**
 * Why: A new, edited or deleted submission changes the submissions lists and its own detail.
 * @returns A function that refetches the submissions queries.
 * @example
 * const refresh = useRefreshSubmissions();
 */
function useRefreshSubmissions() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.submissions.all });
}

/**
 * Why: Sends a new listing for review.
 * @returns A mutation taking `{ input, files }`.
 * @example
 * const { mutateAsync } = useCreateSubmission();
 * await run(() => mutateAsync({ input, files }));
 */
export function useCreateSubmission() {
  const refresh = useRefreshSubmissions();
  return useMutation({
    mutationFn: (request: ListingRequest) => createSubmission(request),
    onSuccess: refresh,
  });
}

/**
 * Why: Saves changes to a submission that has not gone live.
 * @returns A mutation taking `{ id, input, files }`.
 * @example
 * const { mutateAsync } = useUpdateSubmission();
 * await run(() => mutateAsync({ id, input, files }));
 */
export function useUpdateSubmission() {
  const refresh = useRefreshSubmissions();
  return useMutation({
    mutationFn: ({ id, ...request }: ListingRequest & { id: string }) =>
      updateSubmission(id, request),
    onSuccess: refresh,
  });
}

/**
 * Why: Withdraws a submission.
 * @returns A mutation taking the submission id.
 * @example
 * const { mutateAsync } = useDeleteSubmission();
 * await run(() => mutateAsync(id));
 */
export function useDeleteSubmission() {
  const refresh = useRefreshSubmissions();
  return useMutation({
    mutationFn: (id: string) => deleteSubmission(id),
    onSuccess: refresh,
  });
}

/**
 * Why: Editing a live product creates an edit submission for review, so both the live list and
 * the submissions list change.
 * @returns A mutation taking `{ productId, input, files }`.
 * @example
 * const { mutateAsync } = useEditLiveProduct();
 * await run(() => mutateAsync({ productId, input, files }));
 */
export function useEditLiveProduct() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, ...request }: ListingRequest & { productId: string }) =>
      editLiveProduct(productId, request),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.myProducts.all }),
        client.invalidateQueries({ queryKey: queryKeys.submissions.all }),
      ]),
  });
}

/**
 * Why: Taking a live product off sale changes the seller's list and the public catalog.
 * @returns A mutation taking the product id.
 * @example
 * const { mutateAsync } = useRemoveMyProduct();
 * await run(() => mutateAsync(productId));
 */
export function useRemoveMyProduct() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => removeMyProduct(productId),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.myProducts.all }),
        client.invalidateQueries({ queryKey: queryKeys.products.all }),
      ]),
  });
}
