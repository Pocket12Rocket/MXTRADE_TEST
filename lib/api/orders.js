import { API_BASE_URL, apiRequest } from '../apiClient';
import { centsToRands } from './catalog';

/**
 * Why: Checkout, orders and refunds against the FastSport backend (`openapi/openapi.json`), replacing `/api/orders/*`, `/api/payfast/*` and the Firestore order helpers. Every path,
 * header and field name lives here so the pages don't change when the contract is adjusted.
 * The backend is authoritative for prices, delivery fee, stock and status; the client only
 * displays what comes back (D-05).
 */

// Why: Backend province enum values, paired with the labels the checkout select shows. One list
// drives both the dropdown and the mapping so they can't drift.
export const PROVINCES = [
  { value: 'eastern_cape', label: 'Eastern Cape' },
  { value: 'free_state', label: 'Free State' },
  { value: 'gauteng', label: 'Gauteng' },
  { value: 'kwazulu_natal', label: 'KwaZulu-Natal' },
  { value: 'limpopo', label: 'Limpopo' },
  { value: 'mpumalanga', label: 'Mpumalanga' },
  { value: 'northern_cape', label: 'Northern Cape' },
  { value: 'north_west', label: 'North West' },
  { value: 'western_cape', label: 'Western Cape' },
];

// Why: Refund images are required and capped by the backend (D-08); the return page validates
// against the same numbers.
export const REFUND_MIN_IMAGES = 1;
export const REFUND_MAX_IMAGES = 5;

// Why: The backend accepts JPEG, PNG or WebP up to 10 MB each on refund photos (anything larger
// is a 413); the form checks the same limits before uploading.
export const REFUND_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const REFUND_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Why: Buyer-facing wording for the backend's `RefundStatus` enum (`Order.refund.status`); the
// contract only provides an order `statusLabel`, so refund labels live here, once.
const REFUND_STATUS_LABEL = {
  pending: 'Under review',
  accepted: 'Accepted, awaiting your EFT refund',
  denied: 'Denied',
  paid: 'Refunded',
};

// Why: The backend's `OrderStatus` enum. `purchased` is not one of them; the colour map below is
// keyed by exactly these so a new or renamed status shows up here first.
export const ORDER_STATUSES = [
  'pending_payment',
  'payment_failed',
  'cancelled',
  'late_payment',
  'paid',
  'shipped',
  'delivered',
  'refund_pending',
  'refunded',
];

// Why: Badge colours per `OrderStatus`, shared by every order list/detail so they stay identical.
const ORDER_STATUS_COLOUR = {
  pending_payment: 'bg-amber-100 text-amber-700',
  payment_failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
  late_payment: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  shipped: 'bg-blue-100 text-blue-700',
  delivered: 'bg-slate-100 text-slate-700',
  refund_pending: 'bg-amber-100 text-amber-700',
  refunded: 'bg-rose-100 text-rose-700',
};

// Why: The order timeline's first step reads differently for `late_payment` (money arrived after
// the 30-minute hold expired, D-09), so the copy for both cases lives here next to the status
// list instead of being hard-coded in the order page. This follows the Recommended option of a
// DECISIONS.md item still open for Tyron (what happens to a late payment); when he answers, only
// this map and the backend need to change.
const PAYMENT_STEP_COPY = {
  default: {
    label: 'Payment Confirmed',
    sublabel: 'Your payment was received and the order is being prepared.',
  },
  late_payment: {
    label: 'Payment received, being reviewed',
    sublabel:
      "Your payment arrived after the item's hold expired. Our team will contact you about fulfilment or a refund.",
  },
};

const ORDER_TOKEN_HEADER = 'X-Order-Token';
const ORDER_TOKEN_PREFIX = 'fastsport_order_token_';

/**
 * Why: Every order page shows API cents as `R1299.50`; one formatter keeps them identical.
 * @param {number|null|undefined} cents - Amount in cents.
 * @returns {string} Rand amount with two decimals, e.g. `R1299.50`.
 * @example
 * formatRands(129950); // 'R1299.50'
 */
export function formatRands(cents) {
  return `R${centsToRands(cents).toFixed(2)}`;
}

/**
 * Why: Accepts a province label (`Western Cape`) or an enum value and returns the backend enum,
 * so a saved profile value in either form maps correctly.
 * @param {string} [province] - Province label or enum value.
 * @returns {string} The backend enum value, or '' when unknown.
 * @example
 * toProvinceValue('KwaZulu-Natal'); // 'kwazulu_natal'
 */
export function toProvinceValue(province) {
  const text = String(province || '').trim().toLowerCase();
  const match = PROVINCES.find((item) => item.value === text || item.label.toLowerCase() === text);
  return match ? match.value : '';
}

/**
 * Why: One lookup for the order badge colour, with a neutral fallback for a status this client
 * doesn't know yet.
 * @param {string} [status] - `OrderStatus` value from the API.
 * @returns {string} Tailwind classes for the badge.
 * @example
 * orderStatusColour('late_payment'); // 'bg-amber-100 text-amber-700'
 */
export function orderStatusColour(status) {
  return ORDER_STATUS_COLOUR[status] || 'bg-slate-100 text-slate-700';
}

/**
 * Why: One lookup for the refund status wording so every screen labels it identically.
 * @param {string} [status] - `RefundStatus` value: pending, accepted, denied or paid.
 * @returns {string} Friendly label, or the raw value for a status this client doesn't know yet.
 * @example
 * getRefundStatusLabel('accepted'); // 'Accepted, awaiting your EFT refund'
 */
export function getRefundStatusLabel(status) {
  return REFUND_STATUS_LABEL[status] || status || '';
}

/**
 * Why: One lookup for the wording of the order timeline's payment step, so `late_payment` is
 * described in one place (see `PAYMENT_STEP_COPY`).
 * @param {string} [status] - `OrderStatus` value from the API.
 * @returns {{label: string, sublabel: string}} Heading and note for the payment step.
 * @example
 * getPaymentStepCopy('late_payment').label; // 'Payment received, being reviewed'
 */
export function getPaymentStepCopy(status) {
  return PAYMENT_STEP_COPY[status] || PAYMENT_STEP_COPY.default;
}

/**
 * Why: The quote keeps unbuyable lines in `items` (flagged with `available` and
 * `availableQuantity`) but leaves them out of the totals; checkout uses this to flag them and to
 * block paying until the buyer fixes the cart.
 * @param {{available: boolean, availableQuantity: number, quantity: number}} line - Quote line.
 * @returns {'unavailable'|'reduced'|null} `unavailable` when it can't be bought at all, `reduced`
 *   when fewer than the requested units can be, otherwise null.
 * @example
 * getQuoteLineIssue({ available: true, availableQuantity: 1, quantity: 3 }); // 'reduced'
 */
export function getQuoteLineIssue(line) {
  if (!line.available || line.availableQuantity < 1) return 'unavailable';
  if (line.quantity > line.availableQuantity) return 'reduced';
  return null;
}

/**
 * Why: Guests have no session, so their order token is their only credential for that order. It
 * is kept in sessionStorage (tab-scoped, gone when the tab closes) keyed by order id; a token
 * only ever opens the one order it was issued for.
 * @param {string} orderId - Order UUID.
 * @param {string} token - The `accessToken` from `createOrder`.
 * @returns {void}
 * @example
 * storeOrderToken(order.id, accessToken);
 */
export function storeOrderToken(orderId, token) {
  try {
    sessionStorage.setItem(`${ORDER_TOKEN_PREFIX}${orderId}`, token);
  } catch {
    // Storage can be blocked (private mode); the signed-in session or emailed link still works.
  }
}

/**
 * Why: Reads back the token stored by `storeOrderToken` for one order.
 * @param {string} orderId - Order UUID.
 * @returns {string} The token, or '' when none is stored or storage is unavailable.
 * @example
 * const token = getOrderToken(orderId);
 */
export function getOrderToken(orderId) {
  try {
    return sessionStorage.getItem(`${ORDER_TOKEN_PREFIX}${orderId}`) || '';
  } catch {
    return '';
  }
}

/**
 * Why: Builds the guest-access header only when a token exists, so signed-in requests stay
 * cookie-only.
 * @param {string} [token] - Order access token.
 * @returns {Object<string, string>|undefined} Headers for `apiRequest`, or undefined.
 * @example
 * tokenHeaders('abc'); // { 'X-Order-Token': 'abc' }
 */
function tokenHeaders(token) {
  return token ? { [ORDER_TOKEN_HEADER]: token } : undefined;
}

/**
 * Why: The order and quote endpoints take `{productId, quantity}`; cart items use `id`.
 * @param {Array<{id: string, quantity: number}>} items - Cart items.
 * @returns {Array<{productId: string, quantity: number}>} Request items.
 * @example
 * toRequestItems([{ id: 'p1', quantity: 2 }]); // [{ productId: 'p1', quantity: 2 }]
 */
export function toRequestItems(items) {
  return items.map((item) => ({ productId: item.id, quantity: item.quantity }));
}

/**
 * Why: Prices the cart on the server (items, availability, delivery fee, total) so the client
 * never calculates money (D-05). Each returned item also carries `id` (= productId) so the page
 * can match it to the cart.
 * @param {Array<{id: string, quantity: number}>} items - Cart items.
 * @returns {Promise<{items: object[], subtotalCents: number, deliveryFeeCents: number, sellerCount: number, totalCents: number}>} The quote.
 * @throws {ApiProblemError} 409 PRODUCT_UNAVAILABLE, 422 on invalid items, 429 RATE_LIMITED.
 * @example
 * const quote = await quoteCheckout(cartItems);
 */
export async function quoteCheckout(items) {
  const quote = await apiRequest('/checkout/quote', { method: 'POST', body: { items: toRequestItems(items) } });
  return { ...quote, items: (quote.items || []).map((item) => ({ ...item, id: item.productId })) };
}

/**
 * Why: Creates the order and holds stock for 30 minutes (D-09).
 * @param {object} params - Order details.
 * @param {Array<{id: string, quantity: number}>} params.items - Cart items.
 * @param {object} params.shippingAddress - Address with backend province enum.
 * @param {string} [params.buyerEmail] - Required for guests.
 * @param {boolean} [params.acceptTerms] - Required true for guests.
 * @returns {Promise<{order: object, accessToken: string}>} The order and its guest token.
 * @throws {ApiProblemError} 403 AUTH_EMAIL_NOT_VERIFIED, 409 INSUFFICIENT_STOCK, PRODUCT_UNAVAILABLE
 *   or TERMS_VERSION_OUTDATED, 422 (paths `buyerEmail`, `acceptTerms`, `shippingAddress.*`,
 *   `items.N`), 429 RATE_LIMITED.
 * @example
 * const { order, accessToken } = await createOrder({ items, shippingAddress, buyerEmail, acceptTerms: true });
 */
export function createOrder({ items, shippingAddress, buyerEmail, acceptTerms }) {
  const body = { items: toRequestItems(items), shippingAddress };
  if (buyerEmail) body.buyerEmail = buyerEmail;
  if (acceptTerms !== undefined) body.acceptTerms = acceptTerms;
  return apiRequest('/orders', { method: 'POST', body });
}

/**
 * Why: Asks the backend for the signed PayFast form fields for an order.
 * @param {string} orderId - Order UUID.
 * @param {string} [token] - Guest order token.
 * @returns {Promise<{action: string, fields: Object<string, string>}>} The form to post.
 * @throws {ApiProblemError} 409 ORDER_NOT_PAYABLE or RESERVATION_EXPIRED, 403, 404, 429
 *   RATE_LIMITED, 503 SERVICE_UNAVAILABLE (PayFast not configured).
 * @example
 * const form = await startPayfast(order.id, accessToken);
 */
export function startPayfast(orderId, token) {
  return apiRequest(`/orders/${encodeURIComponent(orderId)}/payfast`, { method: 'POST', headers: tokenHeaders(token) });
}

/**
 * Why: Releases the stock hold when the buyer cancels on PayFast.
 * @param {string} orderId - Order UUID.
 * @param {string} [token] - Guest order token.
 * @returns {Promise<null>} Nothing (204).
 * @throws {ApiProblemError} 409 ORDER_NOT_PAYABLE when the order is no longer pending payment.
 * @example
 * await cancelOrder(orderId, getOrderToken(orderId));
 */
export function cancelOrder(orderId, token) {
  return apiRequest(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST', headers: tokenHeaders(token) });
}

/**
 * Why: Loads one order for the session owner or a guest holding its token.
 * @param {string} orderId - Order UUID.
 * @param {string} [token] - Guest order token.
 * @returns {Promise<object>} The order.
 * @throws {ApiProblemError} 403 or 404.
 * @example
 * const order = await getOrder(orderId, getOrderToken(orderId));
 */
export function getOrder(orderId, token) {
  return apiRequest(`/orders/${encodeURIComponent(orderId)}`, { headers: tokenHeaders(token) });
}

/**
 * Why: One page of the signed-in buyer's orders, newest first.
 * @param {object} [options] - Paging options.
 * @param {string} [options.cursor] - `nextCursor` from the previous page.
 * @param {number} [options.limit] - Page size.
 * @returns {Promise<{items: object[], nextCursor: string|null}>} The page.
 * @throws {ApiProblemError} 401 when signed out.
 * @example
 * const { items, nextCursor } = await listMyOrders({ limit: 20 });
 */
export function listMyOrders({ cursor, limit } = {}) {
  return apiRequest('/me/orders', { query: { cursor, limit } });
}

/**
 * Why: Builds the multipart body the refund endpoint expects (`data` JSON plus 1-5 `images`),
 * kept separate so it can be unit-tested without a network.
 * @param {{reason: string, files: File[]}} params - Reason and image files.
 * @returns {FormData} The multipart body.
 * @example
 * const body = buildRefundFormData({ reason: 'Damaged', files: [file] });
 */
export function buildRefundFormData({ reason, files }) {
  const form = new FormData();
  form.append('data', JSON.stringify({ reason }));
  files.forEach((file) => form.append('images', file));
  return form;
}

/**
 * Why: Submits a refund request with its required photos (D-08). Images are sent as chosen (not
 * cropped).
 * @param {string} orderId - Order UUID.
 * @param {{reason: string, files: File[]}} params - Reason and 1-5 image files.
 * @param {string} [token] - Guest order token.
 * @returns {Promise<object>} The updated order (201, status `refund_pending`).
 * @throws {ApiProblemError} 409 ORDER_NOT_REFUNDABLE or REFUND_WINDOW_CLOSED, 413
 *   PAYLOAD_TOO_LARGE, 422 (paths `data.reason`, `images`, `images.N`), 403, 404, 429.
 * @example
 * const order = await requestRefund(orderId, { reason: 'Damaged', files }, token);
 */
export function requestRefund(orderId, { reason, files }, token) {
  return apiRequest(`/orders/${encodeURIComponent(orderId)}/refund-request`, {
    method: 'POST',
    body: buildRefundFormData({ reason, files }),
    headers: tokenHeaders(token),
  });
}

/**
 * Why: Guards `fetchPrivateImageBlob` so credentials only go to the backend's own origin
 * (`NEXT_PUBLIC_API_URL`), or to same-origin URLs when the API is proxied under this site.
 * @param {string} url - Absolute or relative image URL.
 * @returns {boolean} True when the URL's origin matches the API origin.
 * @example
 * isApiOrigin('http://localhost:4000/files/private/abc.webp'); // true when the API is on :4000
 */
export function isApiOrigin(url) {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const apiOrigin = new URL(API_BASE_URL || base, base).origin;
    return new URL(url, base).origin === apiOrigin;
  } catch {
    return false;
  }
}

/**
 * Why: Refund photos are private: the backend serves them only to the session cookie or the
 * `X-Order-Token` header, and an `<img>` can't send a header, so a guest's browser must fetch the
 * bytes itself. This is the one raw `fetch` outside `apiRequest` (which parses JSON), kept here
 * so pages and components never call `fetch` directly.
 * @param {string} url - The refund image `url` from `Order.refund.images`.
 * @param {string} [token] - Guest order token, sent as `X-Order-Token`.
 * @returns {Promise<Blob>} The image bytes.
 * @throws {Error} When the URL is not on the API's origin, or the response is not 2xx.
 * @example
 * const blob = await fetchPrivateImageBlob(image.url, getOrderToken(order.id));
 */
export async function fetchPrivateImageBlob(url, token) {
  // Why: the order token and cookies are credentials; never send them anywhere but our own API,
  // even if a bad URL ever ends up in an order record.
  if (!isApiOrigin(url)) {
    throw new Error('Refusing to send credentials to a non-API image URL');
  }
  const response = await fetch(url, { credentials: 'include', headers: tokenHeaders(token) });
  if (!response.ok) {
    throw new Error(`Image request failed with status ${response.status}`);
  }
  return response.blob();
}

/**
 * Why: PayFast needs a browser POST of the signed fields; this builds a hidden form and submits
 * it, navigating the tab to PayFast. Only https actions are accepted.
 * @param {{action: string, fields: Object<string, string>}} payfast - Response of `startPayfast`.
 * @returns {HTMLFormElement} The submitted form (for tests).
 * @throws {Error} When `action` is not an https URL.
 * @example
 * submitPayfastForm(await startPayfast(order.id, token));
 */
export function submitPayfastForm({ action, fields }) {
  if (!/^https:\/\//i.test(String(action))) {
    throw new Error('Invalid payment URL');
  }
  const form = document.createElement('form');
  form.method = 'post';
  form.action = action;
  form.style.display = 'none';
  Object.entries(fields || {}).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
  return form;
}
