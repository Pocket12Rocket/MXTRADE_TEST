import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FocusEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useCart } from '@/features/cart/cartContext';
import type { CartItem } from '@/features/cart/cartContext';
import useAuth from '@/lib/useAuth';
import { getFieldErrors, isApiProblem } from '@/lib/apiClient';
import {
  PROVINCES,
  type Province,
  formatRands,
  getQuoteLineIssue,
  storeCheckoutToken,
  submitPayfastForm,
  toProvinceValue,
} from '@/lib/api/orders';
import { formatQuoteUnitPrice, type QuoteLine } from '@/lib/api/checkouts';
import { useCheckoutQuote, useCreateCheckout, useStartPayfast } from '@/lib/queries/checkouts';
import { toUserMessage, reportError } from '@/lib/userMessage';
import { useSingleFlight } from '@/lib/useSingleFlight';
import type { Me } from '@/lib/api/types';

interface CheckoutForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  streetAddress: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
}
type FieldMessages = Record<string, string>;
/** A pending checkout kept so a failed payment start retries the same checkout. */
interface PendingCheckout {
  id: string;
  token: string;
}
/** The signed-in `Me`, plus the saved address fields the checkout form pre-fills from. */
type CheckoutProfile = Partial<Me> &
  Partial<
    Record<'streetAddress' | 'suburb' | 'city' | 'province' | 'postCode' | 'postalCode', string>
  >;

const EMPTY_FORM: CheckoutForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  streetAddress: '',
  suburb: '',
  city: '',
  province: '',
  postalCode: '',
};

// Why: The backend reports field errors as `shippingAddress.city` / `buyerEmail`; the form's
// fields are named `city` / `email`. One place maps between them.
const SERVER_FIELD_ALIASES: Record<string, string> = { buyerEmail: 'email', acceptTerms: 'terms' };

/**
 * Why: Validates one checkout field for instant feedback; the backend still validates on submit.
 * @param name - The field name.
 * @param value - The field value.
 * @returns An error message, or null when the value is fine.
 */
function fieldError(name: string, value: string): string | null {
  if (name === 'email') {
    if (!value.trim()) return 'Required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Invalid email address';
    return null;
  }
  if (!value.trim()) return 'Required';
  if (name === 'postalCode' && !/^\d{4}$/.test(value.trim()))
    return 'Must be a 4-digit postal code';
  if (name === 'phone' && !/^[\d\s+-]{7,15}$/.test(value.trim())) return 'Invalid phone number';
  return null;
}

/**
 * Why: Turns the backend's `errors[].path` values into form-field keys, so 422 messages show
 * under the right input.
 * @param fieldErrors - Result of `getFieldErrors(err)`.
 * @returns Messages keyed by form field name.
 * @example
 * toFormErrors({ 'shippingAddress.city': 'Required', buyerEmail: 'Invalid' }); // { city: 'Required', email: 'Invalid' }
 */
function toFormErrors(fieldErrors: FieldMessages): FieldMessages {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([path, message]) => {
      const key = path.replace(/^shippingAddress\./, '');
      return [SERVER_FIELD_ALIASES[key] || key, message];
    }),
  );
}

/**
 * Why: Finds which cart lines a 409 `INSUFFICIENT_STOCK` refers to (`errors[].path` is
 * `items.N`, the index in the items array that was sent).
 * @param fieldErrors - Result of `getFieldErrors(err)`.
 * @param items - The cart items that were sent, in order.
 * @returns Product ids of the flagged lines.
 * @example
 * stockProblemIds({ 'items.1': 'Only 1 left' }, cartItems); // ['product-b']
 */
function stockProblemIds(fieldErrors: FieldMessages, items: Array<{ id: string }>): string[] {
  return Object.keys(fieldErrors)
    .map((path) => /^items\.(\d+)/.exec(path))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => items[Number(match[1])]?.id)
    .filter((id): id is string => Boolean(id));
}

/**
 * Why: Cart, server quote, checkout creation, then one PayFast redirect for the whole checkout.
 * Prices and totals come from the backend quote; failures go through `toUserMessage()`, with
 * per-field messages from `getFieldErrors()`.
 * @returns The checkout form, or an empty-cart state.
 * @example
 * // Rendered by Next.js at /checkout
 * <CheckoutPage />
 */
export default function CheckoutPage() {
  const { user } = useAuth();
  const profile: CheckoutProfile | null = useAuth().profile;
  const { items, removeItem, updateQuantity } = useCart();

  const [edits, setEdits] = useState<Partial<CheckoutForm>>({});
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({});
  const { run, pending: isSubmitting } = useSingleFlight();
  const [submitError, setSubmitError] = useState('');
  const [serverErrors, setServerErrors] = useState<FieldMessages>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOutdated, setTermsOutdated] = useState(false);
  const [problemIds, setProblemIds] = useState<string[]>([]);
  const quoteQuery = useCheckoutQuote(items);
  const createCheckoutMutation = useCreateCheckout();
  const startPayfastMutation = useStartPayfast();
  // Why: Once the checkout exists, a payment-start failure (PayFast 503, rate limit, network) must
  // retry payment for that same checkout instead of creating a duplicate one.
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(null);
  const [serverSaysUnverified, setServerSaysUnverified] = useState(false);

  const isGuest = !user;
  const needsEmailVerification = Boolean(user) && (!user?.emailVerified || serverSaysUnverified);
  const quote = quoteQuery.data ?? null;
  const quoteLoading = quoteQuery.isFetching;
  const quoteFailure = quoteQuery.error;
  const quoteError =
    quoteFailure && !quoteLoading
      ? toUserMessage(quoteFailure, "We couldn't price your cart. Please try again.")
      : '';

  useEffect(() => {
    if (quoteFailure) reportError('checkout-quote', quoteFailure);
  }, [quoteFailure]);

  const hasUnavailableItems =
    Boolean(quote) && quote!.items.some((item) => getQuoteLineIssue(item));
  // Why: With a checkout already created the stock is held, so the quote no longer gates payment.
  const isBlockedByQuote = !pendingCheckout && (quoteLoading || !quote || hasUnavailableItems);

  // Why: A signed-in buyer's form starts from their saved profile; anything they type wins.
  const profileForm = useMemo<CheckoutForm>(() => {
    if (!user) return EMPTY_FORM;
    const displayNameParts = String(profile?.displayName || '')
      .trim()
      .split(/s+/)
      .filter(Boolean);
    const fallbackFirstName = displayNameParts[0] || '';
    const fallbackLastName = displayNameParts.length > 1 ? displayNameParts.slice(1).join(' ') : '';
    return {
      firstName: (profile?.firstName || '').trim() || fallbackFirstName,
      lastName: (profile?.lastName || '').trim() || fallbackLastName,
      email: String(user.email || '').trim(),
      phone: profile?.phone || '',
      streetAddress: profile?.streetAddress || '',
      suburb: profile?.suburb || '',
      city: profile?.city || '',
      province: toProvinceValue(profile?.province),
      postalCode: profile?.postCode || profile?.postalCode || '',
    };
  }, [user, profile]);
  const form: CheckoutForm = { ...profileForm, ...edits };

  const clientErrors = Object.fromEntries(
    Object.entries(form).map(([key, val]) => [key, fieldError(key, val)]),
  );
  const termsError = isGuest && !termsAccepted ? 'You must accept the terms and conditions' : null;
  const hasErrors = Object.values(clientErrors).some(Boolean) || Boolean(termsError);
  const errors = { ...clientErrors, ...serverErrors };

  /**
   * Why: Updates a checkout field as the user types.
   * @param event - The input change event.
   */
  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setEdits((prev) => ({ ...prev, [name]: value }));
    setServerErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev));
  }

  /**
   * Why: Validates a checkout field when it loses focus.
   * @param event - The input blur event.
   */
  function handleBlur(event: FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    setTouched((prev) => ({ ...prev, [event.target.name]: true }));
  }

  /**
   * Why: Marks every field as touched so all errors show on submit.
   */
  function touchAll() {
    setTouched({
      ...Object.fromEntries(Object.keys(EMPTY_FORM).map((key) => [key, true])),
      terms: true,
    });
  }

  /**
   * Why: Maps a failed checkout or payment call to what the buyer sees: stock conflicts flag the
   * affected lines and refresh the quote, 422s show under their fields, and everything else is
   * the backend's user-safe message via `toUserMessage()`.
   * @param err - The caught error.
   * @example
   * handleOrderError(err);
   */
  function handleOrderError(err: unknown) {
    reportError('checkout-submit', err);
    const fieldErrors = getFieldErrors(err);
    const problem = isApiProblem(err) ? err : null;

    if (problem?.code === 'INSUFFICIENT_STOCK' || problem?.code === 'PRODUCT_UNAVAILABLE') {
      setProblemIds(stockProblemIds(fieldErrors, items));
      void quoteQuery.refetch();
    }
    if (problem?.code === 'RESERVATION_EXPIRED' || problem?.code === 'ORDER_NOT_PAYABLE') {
      setPendingCheckout(null);
    }
    setServerSaysUnverified(problem?.code === 'AUTH_EMAIL_NOT_VERIFIED');
    setTermsOutdated(problem?.code === 'TERMS_VERSION_OUTDATED');
    setServerErrors(problem?.status === 422 ? toFormErrors(fieldErrors) : {});
    // Why: on this page a 503 can only come from starting the PayFast payment, and the checkout
    // is already saved, so say so rather than showing the generic "service unavailable" text.
    setSubmitError(
      problem?.code === 'SERVICE_UNAVAILABLE'
        ? 'Payment is temporarily unavailable. Your order has been saved, so please try again in a few minutes.'
        : toUserMessage(err, 'Something went wrong. Please try again.'),
    );
  }

  /**
   * Why: Validates the form, then creates the order and hands the user off to PayFast.
   * @param event - The form submit event.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    touchAll();
    if (hasErrors) return;
    if (items.length === 0) return;
    if (needsEmailVerification || isBlockedByQuote) return;

    setSubmitError('');
    setServerErrors({});
    setProblemIds([]);
    setTermsOutdated(false);
    setServerSaysUnverified(false);

    try {
      await run(
        async () => {
          let target = pendingCheckout;
          if (!target) {
            const shippingAddress = {
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              phone: form.phone.trim(),
              streetAddress: form.streetAddress.trim(),
              suburb: form.suburb.trim(),
              city: form.city.trim(),
              // Validated as required, and the select only offers backend provinces.
              province: form.province as Province,
              postalCode: form.postalCode.trim(),
            };
            const { checkout, accessToken } = await createCheckoutMutation.mutateAsync({
              items,
              shippingAddress,
              ...(isGuest ? { buyerEmail: form.email.trim(), acceptTerms: true } : {}),
            });
            storeCheckoutToken(checkout, accessToken);
            target = { id: checkout.id, token: accessToken };
            setPendingCheckout(target);
          }

          const payfast = await startPayfastMutation.mutateAsync({
            checkoutId: target.id,
            token: target.token,
          });
          // Why: the cart is emptied on the confirmation page once the checkout is actually paid, so a
          // cancelled or failed payment returns the buyer to a cart that still has their items.
          submitPayfastForm(payfast);
        },
        { holdOnSuccess: true },
      );
    } catch (err) {
      handleOrderError(err);
    }
  }

  if (items.length === 0 && !isSubmitting) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
        <p className="text-xl font-semibold text-slate-900">Your cart is empty</p>
        <Link
          href="/shop"
          className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Back to shop
        </Link>
      </div>
    );
  }

  /**
   * Why: One summary line, shared by every seller group and the cart fallback so the availability
   * flags and the fix-it actions look and behave identically wherever the line appears.
   * @param item - A quote line (with `available`/`availableQuantity`) or a cart item.
   * @param fromQuote - True for a quote line (adds price and availability issues).
   * @returns The list item.
   * @example
   * renderLine(quote.items[0], true);
   */
  function renderLine(item: QuoteLine | CartItem, fromQuote: boolean) {
    const quoteLine = fromQuote ? (item as QuoteLine) : null;
    const image = quoteLine ? quoteLine.thumbnailUrl : (item as CartItem).primaryImage;
    const issue = quoteLine ? getQuoteLineIssue(quoteLine) : null;
    const isFlagged = Boolean(issue) || problemIds.includes(item.id);
    return (
      <li key={item.id} className="flex items-center gap-3">
        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {image ? (
            <img src={image} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[9px] font-semibold uppercase text-slate-400">
              No img
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
          {item.quantity > 1 && <p className="text-xs text-slate-500">Qty: {item.quantity}</p>}
          {quoteLine && quoteLine.sellerUnitPriceCents != null ? (
            <p className="text-xs text-slate-500">{formatQuoteUnitPrice(quoteLine)}</p>
          ) : null}
          {isFlagged ? (
            <p className="text-xs text-red-500">
              {issue === 'reduced'
                ? `Only ${quoteLine?.availableQuantity} available.`
                : 'No longer available. It is not included in the total.'}
            </p>
          ) : null}
          {issue === 'reduced' ? (
            <button
              type="button"
              onClick={() => updateQuantity(item.id, quoteLine?.availableQuantity ?? 0)}
              className="text-xs font-semibold text-slate-700 underline"
            >
              Change quantity to {quoteLine?.availableQuantity}
            </button>
          ) : null}
          {issue === 'unavailable' ? (
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="text-xs font-semibold text-slate-700 underline"
            >
              Remove from cart
            </button>
          ) : null}
        </div>
        <p className="text-sm font-semibold text-slate-900">
          {quoteLine ? formatRands(quoteLine.lineTotalCents) : ''}
        </p>
      </li>
    );
  }
  /**
   * Why: Renders a line from the backend quote.
   * @param item - The quote line.
   * @returns The line.
   */
  const renderQuoteLine = (item: QuoteLine) => renderLine(item, true);
  /**
   * Why: Renders a line from the local cart, before a quote exists.
   * @param item - The cart line.
   * @returns The line.
   */
  const renderCartLine = (item: CartItem) => renderLine(item, false);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Checkout</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Shipping details</h1>

      {needsEmailVerification ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Please verify your email address before you check out. Check your inbox for the
          verification link, or resend it from your{' '}
          <Link href="/profile" className="underline">
            profile
          </Link>
          .
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* ── Shipping form ── */}
          <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Delivery address</h2>

            {/* Name row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="First name"
                name="firstName"
                value={form.firstName}
                error={touched.firstName && errors.firstName}
                onChange={handleChange}
                onBlur={handleBlur}
                required
              />
              <Field
                label="Last name"
                name="lastName"
                value={form.lastName}
                error={touched.lastName && errors.lastName}
                onChange={handleChange}
                onBlur={handleBlur}
                required
              />
            </div>

            <Field
              label="Email address"
              name="email"
              type="email"
              value={form.email}
              error={touched.email && errors.email}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="you@example.com"
              required
            />

            <Field
              label="Phone number"
              name="phone"
              type="tel"
              value={form.phone}
              error={touched.phone && errors.phone}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="+27 82 000 0000"
              required
            />
            <Field
              label="Street address"
              name="streetAddress"
              value={form.streetAddress}
              error={touched.streetAddress && errors.streetAddress}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="123 Main Street"
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Suburb"
                name="suburb"
                value={form.suburb}
                error={touched.suburb && errors.suburb}
                onChange={handleChange}
                onBlur={handleBlur}
                required
              />
              <Field
                label="City / Town"
                name="city"
                value={form.city}
                error={touched.city && errors.city}
                onChange={handleChange}
                onBlur={handleBlur}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Province dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">
                  Province <span className="text-red-500">*</span>
                </label>
                <select
                  name="province"
                  value={form.province}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  className={`rounded-xl border px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00CED1] ${
                    touched.province && errors.province
                      ? 'border-red-400 bg-red-50'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  <option value="">Select province</option>
                  {PROVINCES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {touched.province && errors.province && (
                  <p className="text-xs text-red-500">{errors.province}</p>
                )}
              </div>

              <Field
                label="Postal code"
                name="postalCode"
                value={form.postalCode}
                error={touched.postalCode && errors.postalCode}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="0001"
                maxLength={4}
                required
              />
            </div>

            {isGuest ? (
              <div className="flex flex-col gap-1">
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="terms"
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I have read and agree to the FastSport terms and conditions{' '}
                    <span className="text-red-500">*</span>
                  </span>
                </label>
                {touched.terms && (termsError || serverErrors.terms) ? (
                  <p className="text-xs text-red-500">{termsError || serverErrors.terms}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* ── Order summary ── */}
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Order summary</h2>
              {quote ? (
                <>
                  {quote.sellers.map((group) => {
                    // Why: A seller with nothing buyable has no totals or delivery fee (the backend sends 0s), so
                    // show only its flagged lines instead of a misleading R0.00 delivery row.
                    const hasBuyable = group.items.some(
                      (item) => getQuoteLineIssue(item) !== 'unavailable',
                    );
                    return (
                      <div key={group.seller.id} className="mt-4 border-t border-slate-200 pt-4">
                        <p className="text-sm font-semibold text-slate-900">
                          Seller: {group.seller.name}
                        </p>
                        <ul className="mt-3 space-y-3">{group.items.map(renderQuoteLine)}</ul>
                        {hasBuyable ? (
                          <div className="mt-3 space-y-1 text-sm text-slate-700">
                            <div className="flex justify-between">
                              <span>Items</span>
                              <span>{formatRands(group.itemsCents)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Service fee</span>
                              <span>{formatRands(group.serviceFeeCents)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Delivery</span>
                              <span>{formatRands(group.deliveryFeeCents)}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-slate-900">
                              <span>Seller total</span>
                              <span>{formatRands(group.totalCents)}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">
                            None of this seller&apos;s items can be bought, so there is no order or
                            delivery fee for them.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </>
              ) : (
                <ul className="mt-4 space-y-3">{items.map(renderCartLine)}</ul>
              )}
              {quoteError ? <p className="mt-3 text-xs text-red-500">{quoteError}</p> : null}
              <div className="mt-4 border-t border-slate-200 pt-4 space-y-2">
                <div className="flex justify-between text-base">
                  <span>Items</span>
                  <span>{quote ? formatRands(quote.itemsCents) : '…'}</span>
                </div>
                <div className="flex justify-between text-base">
                  <span>Service fee</span>
                  <span>{quote ? formatRands(quote.serviceFeeCents) : '…'}</span>
                </div>
                <div className="flex justify-between text-base">
                  <span>
                    Delivery
                    {quote
                      ? ` (${quote.sellerCount} seller${quote.sellerCount === 1 ? '' : 's'})`
                      : ''}
                  </span>
                  <span>{quote ? formatRands(quote.deliveryFeeCents) : 'Calculating...'}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-slate-900 border-t border-slate-200 pt-2">
                  <span>Total</span>
                  <span>{quote ? formatRands(quote.totalCents) : '…'}</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Your cart is split into one order per seller, paid in one payment. Delivery is
                charged per seller; multiple items from the same seller share one delivery fee.
              </p>
            </div>

            {submitError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {submitError}
                {termsOutdated ? (
                  <>
                    {' '}
                    <Link href="/profile" className="underline">
                      Review the updated terms
                    </Link>
                    .
                  </>
                ) : null}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isBlockedByQuote || needsEmailVerification}
              className="w-full rounded-full bg-[#00CED1] py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#00C5CD] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBlockedByQuote && (quoteLoading || !quote)
                ? 'Calculating delivery…'
                : isSubmitting
                  ? 'Processing…'
                  : pendingCheckout
                    ? 'Retry payment'
                    : 'Continue to payment'}
            </button>

            <Link
              href="/shop"
              className="block text-center text-xs text-slate-500 hover:text-slate-700 underline"
            >
              ← Back to shop
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}

interface FieldProps {
  label: string;
  name: string;
  value: string;
  error?: string | boolean | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur: (event: FocusEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
}

/**
 * Why: A labelled form input with its error message.
 * @param props - Label, name, value, handlers and the error to show.
 * @returns The field.
 * @example
 * <Field label="Email" name="email" value={v} error="" onChange={f} onBlur={b} />
 */
function Field({
  label,
  name,
  value,
  error,
  onChange,
  onBlur,
  type = 'text',
  placeholder = '',
  maxLength,
  required = false,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={name}
        className={`rounded-xl border px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00CED1] ${
          error ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'
        }`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
