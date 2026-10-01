import { apiRequest } from '@/lib/apiClient';
import { formatRands, tokenHeaders } from './orders';
import type {
  CheckoutQuote,
  CheckoutQuoteItem,
  CheckoutQuoteRequest,
  CheckoutQuoteSeller,
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  PayFastCheckout,
  ShippingAddress,
  Checkout,
} from '@/lib/api/types';

/** The part of a cart item the checkout endpoints need. */
export interface CartLine {
  id: string;
  quantity: number;
}

/** A quote line, tagged with `id` (= `productId`) so pages can match it to cart items. */
export type QuoteLine = CheckoutQuoteItem & { id: string };

/** One seller's group of quote lines. */
export type QuoteSellerGroup = Omit<CheckoutQuoteSeller, 'items'> & { items: QuoteLine[] };

/** The checkout quote with every line tagged by `id`. */
export type ClientCheckoutQuote = Omit<CheckoutQuote, 'items' | 'sellers'> & {
  items: QuoteLine[];
  sellers: QuoteSellerGroup[];
};

/** What `createCheckout` needs from the checkout form and cart. */
export interface CreateCheckoutParams {
  items: CartLine[];
  shippingAddress: ShippingAddress;
  /** Required for guests. */
  buyerEmail?: string;
  /** Required true for guests. */
  acceptTerms?: boolean;
}

/**
 * Why: One purchase is a checkout, paid with one PayFast payment, holding one order per seller.
 * Every checkout path and field name lives here; the guest token store and PayFast form post stay
 * in `lib/api/orders.ts` because orders and refunds share them.
 */

/**
 * Why: The quote and checkout endpoints take `{productId, quantity}`; cart items use `id`.
 * @param items - Cart items.
 * @returns Request items.
 * @example
 * toRequestItems([{ id: 'p1', quantity: 2 }]); // [{ productId: 'p1', quantity: 2 }]
 */
export function toRequestItems(items: CartLine[]): CheckoutQuoteRequest['items'] {
  return items.map((item) => ({ productId: item.id, quantity: item.quantity }));
}

/**
 * Why: Pages match quote lines to cart items by `id` (= `productId`), so one mapper tags every
 * line, flat or inside a seller group.
 * @param line - A quote line from the API.
 * @returns The line with `id` set.
 * @example
 * toQuoteLine({ productId: 'p1', quantity: 1 }); // { productId: 'p1', quantity: 1, id: 'p1' }
 */
function toQuoteLine(line: CheckoutQuoteItem): QuoteLine {
  return { ...line, id: line.productId };
}

/**
 * Why: A special can take the price below what the seller is paid, and the buyer should then see
 * only what they pay, not a higher seller price.
 * @param line - A quote line.
 * @returns e.g. `R300.00 each, seller price R250.00`, or `R240.00 each`.
 * @example
 * formatQuoteUnitPrice({ unitPriceCents: 24000, sellerUnitPriceCents: 30000 }); // 'R240.00 each'
 */
export function formatQuoteUnitPrice(
  line: Pick<CheckoutQuoteItem, 'unitPriceCents' | 'sellerUnitPriceCents'>,
): string {
  const each = `${formatRands(line.unitPriceCents)} each`;
  return line.sellerUnitPriceCents <= line.unitPriceCents
    ? `${each}, seller price ${formatRands(line.sellerUnitPriceCents)}`
    : each;
}

/**
 * Why: Prices the cart on the server (items, availability, per-seller totals, delivery fees and
 * the grand total) so the client never calculates money. Every line, unavailable ones included,
 * sits in its seller's group, and each line carries `id` (= productId).
 * @param items - Cart items.
 * @returns The quote.
 * @throws {ApiProblemError} 409 PRODUCT_UNAVAILABLE, 422 on invalid items, 429 RATE_LIMITED.
 * @example
 * const quote = await quoteCheckout(cartItems);
 * quote.sellers[0].totalCents; // that seller's items, fees and delivery
 */
export async function quoteCheckout(items: CartLine[]): Promise<ClientCheckoutQuote> {
  const quote = await apiRequest<CheckoutQuote>('/checkout/quote', {
    method: 'POST',
    body: { items: toRequestItems(items) },
  });
  const sellers = (quote.sellers || []).map((group) => ({
    ...group,
    items: (group.items || []).map(toQuoteLine),
  }));
  return { ...quote, items: (quote.items || []).map(toQuoteLine), sellers };
}

/**
 * Why: Creates the checkout (one order per seller) and holds stock for 30 minutes.
 * @param params - Checkout details.
 * @param params.items - Cart items.
 * @param params.shippingAddress - Address with backend province enum.
 * @param params.buyerEmail - Required for guests.
 * @param params.acceptTerms - Required true for guests.
 * @returns The checkout (with its `orders`) and
 *   the guest token that opens it and every order in it.
 * @throws {ApiProblemError} 403 AUTH_EMAIL_NOT_VERIFIED, 409 INSUFFICIENT_STOCK, PRODUCT_UNAVAILABLE
 *   or TERMS_VERSION_OUTDATED, 422 (paths `buyerEmail`, `acceptTerms`, `shippingAddress.*`,
 *   `items.N`), 429 RATE_LIMITED.
 * @example
 * const { checkout, accessToken } = await createCheckout({ items, shippingAddress, buyerEmail, acceptTerms: true });
 */
export function createCheckout({
  items,
  shippingAddress,
  buyerEmail,
  acceptTerms,
}: CreateCheckoutParams): Promise<CreateCheckoutResponse> {
  const body: CreateCheckoutRequest = { items: toRequestItems(items), shippingAddress };
  if (buyerEmail) body.buyerEmail = buyerEmail;
  if (acceptTerms !== undefined) body.acceptTerms = acceptTerms;
  return apiRequest<CreateCheckoutResponse>('/checkouts', { method: 'POST', body });
}

/**
 * Why: Asks the backend for the signed PayFast form fields for the whole checkout (one payment).
 * @param checkoutId - Checkout UUID.
 * @param token - Guest checkout token.
 * @returns The form to post.
 * @throws {ApiProblemError} 409 ORDER_NOT_PAYABLE or RESERVATION_EXPIRED, 403, 404, 422, 429
 *   RATE_LIMITED, 503 SERVICE_UNAVAILABLE (PayFast not configured).
 * @example
 * submitPayfastForm(await startCheckoutPayfast(checkout.id, accessToken));
 */
export function startCheckoutPayfast(
  checkoutId: string,
  token?: string | null,
): Promise<PayFastCheckout> {
  return apiRequest<PayFastCheckout>(`/checkouts/${encodeURIComponent(checkoutId)}/payfast`, {
    method: 'POST',
    headers: tokenHeaders(token),
  });
}

/**
 * Why: Releases the stock hold of every order in the checkout when the buyer cancels on PayFast
 * (only the whole checkout can be cancelled).
 * @param checkoutId - Checkout UUID.
 * @param token - Guest checkout token.
 * @returns Nothing (204).
 * @throws {ApiProblemError} 409 ORDER_NOT_PAYABLE when the checkout is no longer pending payment.
 * @example
 * await cancelCheckout(checkoutId, getOrderToken(checkoutId));
 */
export function cancelCheckout(checkoutId: string, token?: string | null): Promise<null> {
  return apiRequest<null>(`/checkouts/${encodeURIComponent(checkoutId)}/cancel`, {
    method: 'POST',
    headers: tokenHeaders(token),
  });
}

/**
 * Why: Loads one checkout, with its orders, for the confirmation page (session owner or a guest
 * holding the checkout token).
 * @param checkoutId - Checkout UUID.
 * @param token - Guest checkout token.
 * @returns The checkout: `status` (pending_payment, paid, payment_failed or
 *   cancelled), grand totals and `orders[]`, one per seller.
 * @throws {ApiProblemError} 403 or 404.
 * @example
 * const checkout = await getCheckout(checkoutId, getOrderToken(checkoutId));
 */
export function getCheckout(checkoutId: string, token?: string | null): Promise<Checkout> {
  return apiRequest<Checkout>(`/checkouts/${encodeURIComponent(checkoutId)}`, {
    headers: tokenHeaders(token),
  });
}
