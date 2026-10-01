import { apiRequest } from '../apiClient';
import { tokenHeaders } from './orders';

/**
 * Why: One purchase is a checkout, paid with one PayFast payment, holding one order per seller
 * (D-25; `FastSport_BackEnd/docs/CONTRACT_DRAFTS.md` section 5). Every checkout path, header and
 * field name lives here so pages don't change when the contract is adjusted. The guest token store
 * and the PayFast form post stay in `lib/api/orders.js` because orders and refunds share them.
 */

/**
 * Why: The quote and checkout endpoints take `{productId, quantity}`; cart items use `id`.
 * @param {Array<{id: string, quantity: number}>} items - Cart items.
 * @returns {Array<{productId: string, quantity: number}>} Request items.
 * @example
 * toRequestItems([{ id: 'p1', quantity: 2 }]); // [{ productId: 'p1', quantity: 2 }]
 */
export function toRequestItems(items) {
  return items.map((item) => ({ productId: item.id, quantity: item.quantity }));
}

/**
 * Why: Pages match quote lines to cart items by `id` (= `productId`), and a seller's lines should
 * carry the same availability flags as the flat `items` list, so one mapper tags every line.
 * @param {object} line - A quote line from the API.
 * @param {Object<string, object>} [flatById] - Flat quote lines keyed by productId, whose fields
 *   fill any the seller line lacks (for example `available`).
 * @returns {object} The line with `id` set.
 * @example
 * toQuoteLine({ productId: 'p1', quantity: 1 }, { p1: { available: true } }); // { available: true, productId: 'p1', quantity: 1, id: 'p1' }
 */
function toQuoteLine(line, flatById = {}) {
  return { ...flatById[line.productId], ...line, id: line.productId };
}

/**
 * Why: Prices the cart on the server (items, availability, per-seller totals, delivery fees and
 * the grand total) so the client never calculates money (D-05). The quote's `sellers` groups the
 * lines by seller; each line also carries `id` (= productId), and flat lines that no seller group
 * lists (unavailable ones, which the totals leave out) come back as `unassignedItems` so the page
 * can still flag them.
 * @param {Array<{id: string, quantity: number}>} items - Cart items.
 * @returns {Promise<{items: object[], sellers: Array<{seller: {id: string, name: string}, items: object[], itemsCents: number, serviceFeeCents?: number, subtotalCents: number, deliveryFeeCents: number, totalCents: number}>, unassignedItems: object[], subtotalCents: number, deliveryFeeCents: number, sellerCount: number, totalCents: number}>} The quote.
 * @throws {ApiProblemError} 409 PRODUCT_UNAVAILABLE, 422 on invalid items, 429 RATE_LIMITED.
 * @example
 * const quote = await quoteCheckout(cartItems);
 * quote.sellers[0].totalCents; // that seller's items, fees and delivery
 */
export async function quoteCheckout(items) {
  const quote = await apiRequest('/checkout/quote', { method: 'POST', body: { items: toRequestItems(items) } });
  const flat = (quote.items || []).map((item) => toQuoteLine(item));
  const flatById = Object.fromEntries(flat.map((item) => [item.id, item]));
  const sellers = (quote.sellers || []).map((group) => ({
    ...group,
    items: (group.items || []).map((item) => toQuoteLine(item, flatById)),
  }));
  const grouped = new Set(sellers.flatMap((group) => group.items.map((item) => item.id)));
  return { ...quote, items: flat, sellers, unassignedItems: flat.filter((item) => !grouped.has(item.id)) };
}

/**
 * Why: Creates the checkout (one order per seller) and holds stock for 30 minutes (D-09).
 * @param {object} params - Checkout details.
 * @param {Array<{id: string, quantity: number}>} params.items - Cart items.
 * @param {object} params.shippingAddress - Address with backend province enum.
 * @param {string} [params.buyerEmail] - Required for guests.
 * @param {boolean} [params.acceptTerms] - Required true for guests.
 * @returns {Promise<{checkout: object, accessToken: string}>} The checkout (with its `orders`) and
 *   the guest token that opens it and every order in it.
 * @throws {ApiProblemError} 403 AUTH_EMAIL_NOT_VERIFIED, 409 INSUFFICIENT_STOCK, PRODUCT_UNAVAILABLE
 *   or TERMS_VERSION_OUTDATED, 422 (paths `buyerEmail`, `acceptTerms`, `shippingAddress.*`,
 *   `items.N`), 429 RATE_LIMITED.
 * @example
 * const { checkout, accessToken } = await createCheckout({ items, shippingAddress, buyerEmail, acceptTerms: true });
 */
export function createCheckout({ items, shippingAddress, buyerEmail, acceptTerms }) {
  const body = { items: toRequestItems(items), shippingAddress };
  if (buyerEmail) body.buyerEmail = buyerEmail;
  if (acceptTerms !== undefined) body.acceptTerms = acceptTerms;
  return apiRequest('/checkouts', { method: 'POST', body });
}

/**
 * Why: Asks the backend for the signed PayFast form fields for the whole checkout (one payment).
 * @param {string} checkoutId - Checkout UUID.
 * @param {string} [token] - Guest checkout token.
 * @returns {Promise<{action: string, fields: Object<string, string>}>} The form to post.
 * @throws {ApiProblemError} 409 ORDER_NOT_PAYABLE or RESERVATION_EXPIRED, 403, 404, 429
 *   RATE_LIMITED, 503 SERVICE_UNAVAILABLE (PayFast not configured).
 * @example
 * submitPayfastForm(await startCheckoutPayfast(checkout.id, accessToken));
 */
export function startCheckoutPayfast(checkoutId, token) {
  return apiRequest(`/checkouts/${encodeURIComponent(checkoutId)}/payfast`, { method: 'POST', headers: tokenHeaders(token) });
}

/**
 * Why: Releases the stock hold of every order in the checkout when the buyer cancels on PayFast
 * (only the whole checkout can be cancelled, D-25).
 * @param {string} checkoutId - Checkout UUID.
 * @param {string} [token] - Guest checkout token.
 * @returns {Promise<null>} Nothing (204).
 * @throws {ApiProblemError} 409 ORDER_NOT_PAYABLE when the checkout is no longer pending payment.
 * @example
 * await cancelCheckout(checkoutId, getOrderToken(checkoutId));
 */
export function cancelCheckout(checkoutId, token) {
  return apiRequest(`/checkouts/${encodeURIComponent(checkoutId)}/cancel`, { method: 'POST', headers: tokenHeaders(token) });
}

/**
 * Why: Loads one checkout, with its orders, for the confirmation page (session owner or a guest
 * holding the checkout token).
 * @param {string} checkoutId - Checkout UUID.
 * @param {string} [token] - Guest checkout token.
 * @returns {Promise<object>} The checkout: `status` (pending_payment, paid, payment_failed or
 *   cancelled), grand totals and `orders[]`, one per seller.
 * @throws {ApiProblemError} 403 or 404.
 * @example
 * const checkout = await getCheckout(checkoutId, getOrderToken(checkoutId));
 */
export function getCheckout(checkoutId, token) {
  return apiRequest(`/checkouts/${encodeURIComponent(checkoutId)}`, { headers: tokenHeaders(token) });
}
