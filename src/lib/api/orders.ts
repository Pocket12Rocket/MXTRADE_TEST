import { API_BASE_URL, apiRequest } from '@/lib/apiClient';
import { centsToRands } from './catalog';
import type {
  Checkout,
  CheckoutQuoteItem,
  Order,
  OrderPage,
  OrderStatus,
  PayFastCheckout,
  RefundRequestInput,
  RefundStatus,
  RefundType,
  ShippingAddress,
} from '@/lib/api/types';

/** A backend province enum value (`gauteng`, `western_cape`, ...). */
export type Province = ShippingAddress['province'];

/** One refund type with its buyer-facing label and photo/reason minimums. */
export interface RefundTypeOption {
  value: RefundType;
  label: string;
  minImages: number;
  minReasonLength: number;
}

/** The photo and reason rules for one refund type. */
export interface RefundRules {
  minImages: number;
  maxImages: number;
  minReasonLength: number;
}

/** Heading and note for the order timeline's payment step. */
export interface PaymentStepCopy {
  label: string;
  sublabel: string;
}

/** Refund details and photos, as the refund form collects them. */
export type RefundSubmission = RefundRequestInput & { files: File[] };

/**
 * Why: Orders, guest tokens and refunds against the FastSport backend. Every path, header and
 * field name lives here; the client only displays prices, fees, stock and status the backend returns.
 */

// Why: Backend province enum values, paired with the labels the checkout select shows. One list
// drives both the dropdown and the mapping so they can't drift.
export const PROVINCES: ReadonlyArray<{ value: Province; label: string }> = [
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

// Why: The backend's refund `type` enum with its buyer-facing label and per-type photo and reason
// minimums, so the form, its validation and the helpers read from one place.
export const REFUND_TYPES: RefundTypeOption[] = [
  { value: 'damaged', label: 'Item arrived damaged', minImages: 1, minReasonLength: 1 },
  { value: 'not_as_described', label: 'Not as described', minImages: 1, minReasonLength: 1 },
  { value: 'never_arrived', label: 'Never arrived', minImages: 0, minReasonLength: 1 },
  { value: 'other', label: 'Other issue', minImages: 1, minReasonLength: 20 },
];
// Why: `never_arrived` has its own "Report not arrived" entry point, so the problem picker
// offers only the other three; the form adds `never_arrived` back only when opened from that link.
export const NOT_ARRIVED_TYPE: RefundType = 'never_arrived';
export const REFUND_PROBLEM_TYPES = REFUND_TYPES.filter((item) => item.value !== NOT_ARRIVED_TYPE);
export const REFUND_MAX_IMAGES = 5;
export const REFUND_MAX_REASON_LENGTH = 1000;

// Why: The backend accepts JPEG, PNG or WebP up to 10 MB each on refund photos (anything larger
// is a 413); the form checks the same limits before uploading.
export const REFUND_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const REFUND_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Why: Buyer-facing wording for the backend's `RefundStatus` enum (`Order.refund.status`); the
// contract only provides an order `statusLabel`, so refund labels live here, once.
const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  pending: 'Under review',
  accepted: 'Accepted, awaiting your EFT refund',
  denied: 'Denied',
  paid: 'Refunded',
};

// Why: The backend's `OrderStatus` enum. `purchased` is not one of them; the colour map below is
// keyed by exactly these so a new or renamed status shows up here first.
export const ORDER_STATUSES: OrderStatus[] = [
  'pending_payment',
  'payment_failed',
  'cancelled',
  'late_payment',
  'paid',
  'shipped',
  'delivered',
  'completed',
  'refund_pending',
  'refunded',
];

// Why: Badge colours per `OrderStatus`, shared by every order list/detail so they stay identical.
const ORDER_STATUS_COLOUR: Record<OrderStatus, string> = {
  pending_payment: 'bg-amber-100 text-amber-700',
  payment_failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
  late_payment: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  shipped: 'bg-blue-100 text-blue-700',
  delivered: 'bg-slate-100 text-slate-700',
  completed: 'bg-teal-100 text-teal-700',
  refund_pending: 'bg-amber-100 text-amber-700',
  refunded: 'bg-rose-100 text-rose-700',
};

// Why: The order timeline's first step reads differently for `late_payment`, so the copy for both
// cases lives here next to the status list.
const PAYMENT_STEP_COPY: { default: PaymentStepCopy; late_payment: PaymentStepCopy } = {
  default: {
    label: 'Payment Confirmed',
    sublabel: 'Your payment was received and the order is being prepared.',
  },
  late_payment: {
    label: 'Payment under review',
    sublabel:
      'Your payment arrived after the stock hold expired, so our team is reviewing your order. Items still in stock are held for you, and we will contact you about fulfilment or a refund.',
  },
};

const ORDER_TOKEN_HEADER = 'X-Order-Token';
const ORDER_TOKEN_PREFIX = 'fastsport_order_token_';

/**
 * Why: Every order page shows API cents as `R1299.50`; one formatter keeps them identical.
 * @param cents - Amount in cents.
 * @returns Rand amount with two decimals, e.g. `R1299.50`.
 * @example
 * formatRands(129950); // 'R1299.50'
 */
export function formatRands(cents: number | null | undefined): string {
  return `R${centsToRands(cents).toFixed(2)}`;
}

/**
 * Why: Accepts a province label (`Western Cape`) or an enum value and returns the backend enum,
 * so a saved profile value in either form maps correctly.
 * @param province - Province label or enum value.
 * @returns The backend enum value, or '' when unknown.
 * @example
 * toProvinceValue('KwaZulu-Natal'); // 'kwazulu_natal'
 */
export function toProvinceValue(province: string | null | undefined): Province | '' {
  const text = String(province || '')
    .trim()
    .toLowerCase();
  const match = PROVINCES.find((item) => item.value === text || item.label.toLowerCase() === text);
  return match ? match.value : '';
}

/**
 * Why: One lookup for the order badge colour, with a neutral fallback for a status this client
 * doesn't know yet.
 * @param status - `OrderStatus` value from the API.
 * @returns Tailwind classes for the badge.
 * @example
 * orderStatusColour('late_payment'); // 'bg-amber-100 text-amber-700'
 */
export function orderStatusColour(status: string | null | undefined): string {
  return (
    (status && (ORDER_STATUS_COLOUR as Record<string, string>)[status]) ||
    'bg-slate-100 text-slate-700'
  );
}

/**
 * Why: One lookup for the refund status wording so every screen labels it identically.
 * @param status - `RefundStatus` value: pending, accepted, denied or paid.
 * @returns Friendly label, or the raw value for a status this client doesn't know yet.
 * @example
 * getRefundStatusLabel('accepted'); // 'Accepted, awaiting your EFT refund'
 */
export function getRefundStatusLabel(status: string | null | undefined): string {
  return (status && (REFUND_STATUS_LABEL as Record<string, string>)[status]) || status || '';
}

/**
 * Why: One lookup for the refund type wording so the form and the order page label it identically.
 * @param type - Refund `type`: damaged, not_as_described, never_arrived or other.
 * @returns Friendly label, or the raw value for a type this client doesn't know yet.
 * @example
 * getRefundTypeLabel('never_arrived'); // 'Never arrived'
 */
export function getRefundTypeLabel(type: string | null | undefined): string {
  return REFUND_TYPES.find((item) => item.value === type)?.label || type || '';
}

/**
 * Why: The photo and reason rules differ per refund type (see `REFUND_TYPES`); the form reads
 * them here instead of repeating type checks.
 * @param type - Refund `type`; unknown or empty gets the strictest photo rule.
 * @returns The rules.
 * @example
 * getRefundRules('never_arrived'); // { minImages: 0, maxImages: 5, minReasonLength: 1 }
 */
export function getRefundRules(type: string | null | undefined): RefundRules {
  const match = REFUND_TYPES.find((item) => item.value === type) ?? REFUND_TYPES[0]!;
  return {
    minImages: match.minImages,
    maxImages: REFUND_MAX_IMAGES,
    minReasonLength: match.minReasonLength,
  };
}

/**
 * Why: One lookup for the wording of the order timeline's payment step, so `late_payment` is
 * described in one place (see `PAYMENT_STEP_COPY`).
 * @param status - `OrderStatus` value from the API.
 * @returns Heading and note for the payment step.
 * @example
 * getPaymentStepCopy('late_payment').label; // 'Payment under review'
 */
export function getPaymentStepCopy(status: string | null | undefined): PaymentStepCopy {
  return status === 'late_payment' ? PAYMENT_STEP_COPY.late_payment : PAYMENT_STEP_COPY.default;
}

/**
 * Why: The quote keeps unbuyable lines in `items` (flagged with `available` and
 * `availableQuantity`) but leaves them out of the totals; checkout uses this to flag them and to
 * block paying until the buyer fixes the cart.
 * @param line - Quote line.
 * @returns `unavailable` when it can't be bought at all, `reduced`
 *   when fewer than the requested units can be, otherwise null.
 * @example
 * getQuoteLineIssue({ available: true, availableQuantity: 1, quantity: 3 }); // 'reduced'
 */
export function getQuoteLineIssue(
  line: Pick<CheckoutQuoteItem, 'available' | 'availableQuantity' | 'quantity'>,
): 'unavailable' | 'reduced' | null {
  if (!line.available || line.availableQuantity < 1) return 'unavailable';
  if (line.quantity > line.availableQuantity) return 'reduced';
  return null;
}

/**
 * Why: Guests have no session, so their token is their only credential. It is kept in
 * sessionStorage, keyed by order id (or checkout id, see `storeCheckoutToken`).
 * @param orderId - Order UUID.
 * @param token - The order's access token (from the emailed link, or `storeCheckoutToken`).
 * @example
 * storeOrderToken(order.id, accessToken);
 */
export function storeOrderToken(orderId: string, token: string): void {
  try {
    sessionStorage.setItem(`${ORDER_TOKEN_PREFIX}${orderId}`, token);
  } catch {
    // Storage can be blocked (private mode); the signed-in session or emailed link still works.
  }
}

/**
 * Why: Reads back the token stored by `storeOrderToken` for one order.
 * @param orderId - Order UUID.
 * @returns The token, or '' when none is stored or storage is unavailable.
 * @example
 * const token = getOrderToken(orderId);
 */
export function getOrderToken(orderId: string | null | undefined): string {
  try {
    return sessionStorage.getItem(`${ORDER_TOKEN_PREFIX}${orderId}`) || '';
  } catch {
    return '';
  }
}

/**
 * Why: A guest's checkout token opens the checkout and every order in it, but the order and
 * refund pages only know an order id. This stores the token under the checkout id and under each
 * order id of the checkout, so `getOrderToken(id)` works for either.
 * @param checkout - The checkout from `createCheckout`.
 * @param token - The `accessToken` from `createCheckout`.
 * @example
 * storeCheckoutToken(checkout, accessToken);
 */
export function storeCheckoutToken(
  checkout: Pick<Checkout, 'id'> & { orders?: Array<Pick<Order, 'id'>> },
  token: string,
): void {
  [checkout.id, ...(checkout.orders || []).map((order) => order.id)].forEach((id) =>
    storeOrderToken(id, token),
  );
}

/**
 * Why: Builds the guest-access header only when a token exists, so signed-in requests stay
 * cookie-only.
 * @param token - Order access token.
 * @returns Headers for `apiRequest`, or undefined.
 * @example
 * tokenHeaders('abc'); // { 'X-Order-Token': 'abc' }
 */
export function tokenHeaders(token: string | null | undefined): Record<string, string> | undefined {
  return token ? { [ORDER_TOKEN_HEADER]: token } : undefined;
}

/**
 * Why: Loads one order for the session owner or a guest holding its token.
 * @param orderId - Order UUID.
 * @param token - Guest order token.
 * @returns The order.
 * @throws {ApiProblemError} 403 or 404.
 * @example
 * const order = await getOrder(orderId, getOrderToken(orderId));
 */
export function getOrder(orderId: string, token?: string | null): Promise<Order> {
  return apiRequest<Order>(`/orders/${encodeURIComponent(orderId)}`, {
    headers: tokenHeaders(token),
  });
}

/**
 * Why: One page of the signed-in buyer's orders, newest first.
 * @param options - Paging options.
 * @param options.cursor - `nextCursor` from the previous page.
 * @param options.limit - Page size.
 * @returns The page.
 * @throws {ApiProblemError} 401 when signed out.
 * @example
 * const { items, nextCursor } = await listMyOrders({ limit: 20 });
 */
export function listMyOrders({
  cursor,
  limit,
}: { cursor?: string | null; limit?: number } = {}): Promise<OrderPage> {
  return apiRequest<OrderPage>('/me/orders', { query: { cursor, limit } });
}

/**
 * Why: Builds the multipart body the refund endpoint expects (`data` JSON of
 * `{ type, reason, bankAccount }` plus up to 5 `images`), kept separate so it can be unit-tested
 * without a network.
 * @param params - Refund details and image files.
 * @returns The multipart body.
 * @example
 * const body = buildRefundFormData({ type: 'damaged', reason: 'Cracked', bankAccount, files: [file] });
 */
export function buildRefundFormData({
  type,
  reason,
  bankAccount,
  files,
}: RefundSubmission): FormData {
  const form = new FormData();
  form.append('data', JSON.stringify({ type, reason, bankAccount }));
  files.forEach((file) => form.append('images', file));
  return form;
}

/**
 * Why: Submits a refund request. Photos are required except for `never_arrived`.
 * Images are sent as chosen (not cropped); the bank details are where the refund EFT goes.
 * @param orderId - Order UUID.
 * @param params - Refund
 *   details and 0-5 image files (1-5 unless the type is `never_arrived`).
 * @param token - Guest order token.
 * @returns The updated order (201, status `refund_pending`).
 * @throws {ApiProblemError} 409 REFUND_WINDOW_CLOSED, NOT_ARRIVED_TOO_EARLY or ORDER_NOT_REFUNDABLE,
 *   413 PAYLOAD_TOO_LARGE, 422 (paths `data.type`, `data.reason`, `data.bankAccount.*`, `images`,
 *   `images.N`), 403, 404, 429.
 * @example
 * const order = await requestRefund(orderId, { type: 'damaged', reason: 'Cracked', bankAccount, files }, token);
 */
export function requestRefund(
  orderId: string,
  { type, reason, bankAccount, files }: RefundSubmission,
  token?: string | null,
): Promise<Order> {
  return apiRequest<Order>(`/orders/${encodeURIComponent(orderId)}/refund-request`, {
    method: 'POST',
    body: buildRefundFormData({ type, reason, bankAccount, files }),
    headers: tokenHeaders(token),
  });
}

/**
 * Why: Guards `fetchPrivateImageBlob` so credentials only go to the backend's own origin
 * (`NEXT_PUBLIC_API_URL`), or to same-origin URLs when the API is proxied under this site.
 * @param url - Absolute or relative image URL.
 * @returns True when the URL's origin matches the API origin.
 * @example
 * isApiOrigin('http://localhost:4000/files/private/abc.webp'); // true when the API is on :4000
 */
export function isApiOrigin(url: string): boolean {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const apiOrigin = new URL(API_BASE_URL || base, base).origin;
    return new URL(url, base).origin === apiOrigin;
  } catch {
    return false;
  }
}

/**
 * Why: An `<img>` can't send the `X-Order-Token` header, so a guest's browser fetches the private
 * refund photo bytes itself. This is the one raw `fetch` outside `apiRequest`.
 * @param url - The refund image `url` from `Order.refund.images`.
 * @param token - Guest order token, sent as `X-Order-Token`.
 * @returns The image bytes.
 * @throws {Error} When the URL is not on the API's origin, or the response is not 2xx.
 * @example
 * const blob = await fetchPrivateImageBlob(image.url, getOrderToken(order.id));
 */
export async function fetchPrivateImageBlob(url: string, token?: string | null): Promise<Blob> {
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
 * @param payfast - Response of `startCheckoutPayfast`.
 * @returns The submitted form (for tests).
 * @throws {Error} When `action` is not an https URL.
 * @example
 * submitPayfastForm(await startCheckoutPayfast(checkout.id, token));
 */
export function submitPayfastForm({ action, fields }: PayFastCheckout): HTMLFormElement {
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
