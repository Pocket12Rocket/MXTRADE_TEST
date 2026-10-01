import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getOrder, listMyOrders, requestRefund } from '@/lib/api/orders';
import type { RefundSubmission } from '@/lib/api/orders';
import { confirmDelivery } from '@/lib/api/returns';
import type { Order } from '@/lib/api/types';
import { cursorPaging } from '@/lib/queries/pagination';
import { queryKeys } from '@/lib/queryKeys';

/** Identifies an order for a mutation; `token` is the guest order token. */
interface OrderTarget {
  orderId: string;
  token?: string | null;
}

/**
 * Why: The "My orders" list loads page by page for the signed-in buyer.
 * @param limit - Optional page size.
 * @returns The infinite query of order summaries.
 * @example
 * const { data, fetchNextPage, hasNextPage } = useMyOrders();
 */
export function useMyOrders(limit?: number) {
  return useInfiniteQuery({
    queryKey: queryKeys.orders.list,
    queryFn: ({ pageParam }) => listMyOrders({ cursor: pageParam, limit }),
    ...cursorPaging,
  });
}

/**
 * Why: Signed-in buyers and guests (with an email-link token) both read an order through the same hook.
 * @param id - Order UUID; nothing is fetched while empty.
 * @param token - Guest order token.
 * @returns The order query.
 * @example
 * const { data: order } = useOrder(orderId, getOrderToken(orderId));
 */
export function useOrder(id: string | null | undefined, token?: string | null) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id ?? ''),
    queryFn: () => getOrder(id as string, token),
    enabled: Boolean(id),
  });
}

/**
 * Why: Both order mutations return the updated order, so the detail is replaced and the list
 * (which shows its status) is refetched.
 * @returns A function that applies an updated order to the cache.
 * @example
 * const applyOrder = useApplyOrder();
 */
function useApplyOrder() {
  const client = useQueryClient();
  return (order: Order): Promise<void> => {
    client.setQueryData(queryKeys.orders.detail(order.id), order);
    return client.invalidateQueries({ queryKey: queryKeys.orders.list });
  };
}

/**
 * Why: The buyer confirms the parcel arrived so the sale completes early.
 * @returns A mutation taking `{ orderId, token }` and returning the updated order.
 * @example
 * const { mutateAsync } = useConfirmDelivery();
 * await run(() => mutateAsync({ orderId, token }));
 */
export function useConfirmDelivery() {
  const applyOrder = useApplyOrder();
  return useMutation({
    mutationFn: ({ orderId, token }: OrderTarget) => confirmDelivery(orderId, token),
    onSuccess: applyOrder,
  });
}

/**
 * Why: The buyer asks for a refund with reason, bank details and photos.
 * @returns A mutation taking `{ orderId, submission, token }` and returning the updated order.
 * @example
 * const { mutateAsync } = useRequestRefund();
 * await run(() => mutateAsync({ orderId, submission, token }));
 */
export function useRequestRefund() {
  const applyOrder = useApplyOrder();
  return useMutation({
    mutationFn: ({ orderId, submission, token }: OrderTarget & { submission: RefundSubmission }) =>
      requestRefund(orderId, submission, token),
    onSuccess: applyOrder,
  });
}
