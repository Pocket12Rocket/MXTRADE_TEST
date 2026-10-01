import { apiRequest } from '@/lib/apiClient';
import { tokenHeaders } from './orders';

/**
 * Why: Returns and completing the sale against the FastSport backend.
 */

/**
 * Why: The buyer (signed in, or a guest holding the order token) confirms the parcel arrived and
 * is fine, so the sale completes without waiting the 48 hours for the automatic completion.
 * @param {string} orderId - Order UUID.
 * @param {string} [token] - Guest order token, sent as `X-Order-Token` when present.
 * @returns {Promise<object>} The updated order (200, status `completed`, `completedBy` 'buyer').
 * @throws {ApiProblemError} 409 ORDER_NOT_CONFIRMABLE when the order isn't `delivered` or has an
 *   open refund request, 403, 404, 429.
 * @example
 * const order = await confirmDelivery(orderId, getOrderToken(orderId));
 */
export function confirmDelivery(orderId, token) {
  return apiRequest(`/orders/${encodeURIComponent(orderId)}/confirm-delivery`, {
    method: 'POST',
    headers: tokenHeaders(token),
  });
}
