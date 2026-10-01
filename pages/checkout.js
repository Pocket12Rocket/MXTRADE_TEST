import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useCart } from '../lib/cartContext';
import useAuth from '../lib/useAuth';
import { getFieldErrors } from '../lib/apiClient';
import {
  PROVINCES,
  formatRands,
  getQuoteLineIssue,
  storeCheckoutToken,
  submitPayfastForm,
  toProvinceValue,
} from '../lib/api/orders';
import { createCheckout, quoteCheckout, startCheckoutPayfast } from '../lib/api/checkouts';
import { toUserMessage, reportError } from '../lib/userMessage';

const EMPTY_FORM = {
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
const SERVER_FIELD_ALIASES = { buyerEmail: 'email', acceptTerms: 'terms' };

function fieldError(name, value) {
  if (name === 'email') {
    if (!value.trim()) return 'Required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Invalid email address';
    return null;
  }
  if (!value.trim()) return 'Required';
  if (name === 'postalCode' && !/^\d{4}$/.test(value.trim())) return 'Must be a 4-digit postal code';
  if (name === 'phone' && !/^[\d\s\+\-]{7,15}$/.test(value.trim())) return 'Invalid phone number';
  return null;
}

/**
 * Why: Turns the backend's `errors[].path` values into form-field keys, so 422 messages show
 * under the right input.
 * @param {Object<string, string>} fieldErrors - Result of `getFieldErrors(err)`.
 * @returns {Object<string, string>} Messages keyed by form field name.
 * @example
 * toFormErrors({ 'shippingAddress.city': 'Required', buyerEmail: 'Invalid' }); // { city: 'Required', email: 'Invalid' }
 */
function toFormErrors(fieldErrors) {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([path, message]) => {
      const key = path.replace(/^shippingAddress\./, '');
      return [SERVER_FIELD_ALIASES[key] || key, message];
    })
  );
}

/**
 * Why: Finds which cart lines a 409 `INSUFFICIENT_STOCK` refers to (`errors[].path` is
 * `items.N`, the index in the items array that was sent).
 * @param {Object<string, string>} fieldErrors - Result of `getFieldErrors(err)`.
 * @param {Array<{id: string}>} items - The cart items that were sent, in order.
 * @returns {string[]} Product ids of the flagged lines.
 * @example
 * stockProblemIds({ 'items.1': 'Only 1 left' }, cartItems); // ['product-b']
 */
function stockProblemIds(fieldErrors, items) {
  return Object.keys(fieldErrors)
    .map((path) => /^items\.(\d+)/.exec(path))
    .filter(Boolean)
    .map((match) => items[Number(match[1])]?.id)
    .filter(Boolean);
}

/**
 * Why: Cart, server quote, checkout creation, then one PayFast redirect for the whole checkout
 * (one order per seller, D-25). Prices, availability, each seller's fees and the grand total all
 * come from the backend quote (D-05); the client never computes money. Guests can check out (D-10) with an email and accepted terms; signed-in buyers must have
 * a verified email (D-11). Every failure goes through `toUserMessage()`, with per-field
 * messages from `getFieldErrors()`.
 * @returns {JSX.Element} The checkout form, or an empty-cart state.
 * @example
 * // Rendered by Next.js at /checkout
 * <CheckoutPage />
 */
export default function CheckoutPage() {
  const { user, profile } = useAuth();
  const { items, removeItem, updateQuantity } = useCart();

  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [serverErrors, setServerErrors] = useState({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOutdated, setTermsOutdated] = useState(false);
  const [problemIds, setProblemIds] = useState([]);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteVersion, setQuoteVersion] = useState(0);
  // Why: Once the checkout exists, a payment-start failure (PayFast 503, rate limit, network) must
  // retry payment for that same checkout instead of creating a duplicate one.
  const [pendingCheckout, setPendingCheckout] = useState(null);
  const [serverSaysUnverified, setServerSaysUnverified] = useState(false);

  const isGuest = !user;
  const needsEmailVerification = Boolean(user) && (!user.emailVerified || serverSaysUnverified);
  const cartKey = useMemo(() => JSON.stringify(items.map((item) => [item.id, item.quantity])), [items]);

  useEffect(() => {
    if (items.length === 0) {
      setQuote(null);
      return undefined;
    }

    let isMounted = true;
    setQuoteLoading(true);
    setQuoteError('');
    quoteCheckout(items)
      .then((result) => {
        if (isMounted) setQuote(result);
      })
      .catch((err) => {
        reportError('checkout-quote', err);
        if (isMounted) setQuoteError(toUserMessage(err, "We couldn't price your cart. Please try again."));
      })
      .finally(() => {
        if (isMounted) setQuoteLoading(false);
      });

    return () => {
      isMounted = false;
    };
    // `items` is tracked through `cartKey` (ids and quantities) so cart-object churn doesn't re-quote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, quoteVersion]);

  const hasUnavailableItems = Boolean(quote) && quote.items.some((item) => getQuoteLineIssue(item));
  // Why: With a checkout already created the stock is held, so the quote no longer gates payment.
  const isBlockedByQuote = !pendingCheckout && (quoteLoading || !quote || hasUnavailableItems);

  useEffect(() => {
    if (!user) return;

    const profileFirstName = (profile?.firstName || '').trim();
    const profileLastName = (profile?.lastName || '').trim();
    const displayNameParts = String(profile?.displayName || user.displayName || '').trim().split(/\s+/).filter(Boolean);
    const fallbackFirstName = displayNameParts[0] || '';
    const fallbackLastName = displayNameParts.length > 1 ? displayNameParts.slice(1).join(' ') : '';

    setForm((current) => ({
      ...current,
      firstName: profileFirstName || fallbackFirstName,
      lastName: profileLastName || fallbackLastName,
      email: String(user.email || '').trim(),
      phone: profile?.phone || '',
      streetAddress: profile?.streetAddress || '',
      suburb: profile?.suburb || '',
      city: profile?.city || '',
      province: toProvinceValue(profile?.province),
      postalCode: profile?.postCode || profile?.postalCode || '',
    }));
  }, [user, profile]);

  const clientErrors = Object.fromEntries(
    Object.entries(form).map(([key, val]) => [key, fieldError(key, val)])
  );
  const termsError = isGuest && !termsAccepted ? 'You must accept the terms and conditions' : null;
  const hasErrors = Object.values(clientErrors).some(Boolean) || Boolean(termsError);
  const errors = { ...clientErrors, ...serverErrors };

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setServerErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev));
  }

  function handleBlur(event) {
    setTouched((prev) => ({ ...prev, [event.target.name]: true }));
  }

  function touchAll() {
    setTouched({ ...Object.fromEntries(Object.keys(EMPTY_FORM).map((key) => [key, true])), terms: true });
  }

  /**
   * Why: Maps a failed checkout or payment call to what the buyer sees: stock conflicts flag the
   * affected lines and refresh the quote, 422s show under their fields, and everything else is
   * the backend's user-safe message via `toUserMessage()`.
   * @param {*} err - The caught error.
   * @returns {void}
   * @example
   * handleOrderError(err);
   */
  function handleOrderError(err) {
    reportError('checkout-submit', err);
    const fieldErrors = getFieldErrors(err);

    if (err?.code === 'INSUFFICIENT_STOCK' || err?.code === 'PRODUCT_UNAVAILABLE') {
      setProblemIds(stockProblemIds(fieldErrors, items));
      setQuoteVersion((version) => version + 1);
    }
    if (err?.code === 'RESERVATION_EXPIRED' || err?.code === 'ORDER_NOT_PAYABLE') {
      setPendingCheckout(null);
    }
    setServerSaysUnverified(err?.code === 'AUTH_EMAIL_NOT_VERIFIED');
    setTermsOutdated(err?.code === 'TERMS_VERSION_OUTDATED');
    setServerErrors(err?.status === 422 ? toFormErrors(fieldErrors) : {});
    // Why: on this page a 503 can only come from starting the PayFast payment, and the checkout
    // is already saved, so say so rather than showing the generic "service unavailable" text.
    setSubmitError(err?.code === 'SERVICE_UNAVAILABLE'
      ? 'Payment is temporarily unavailable. Your order has been saved, so please try again in a few minutes.'
      : toUserMessage(err, 'Something went wrong. Please try again.'));
    setIsSubmitting(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    touchAll();
    if (hasErrors) return;
    if (items.length === 0) return;
    if (needsEmailVerification || isBlockedByQuote) return;

    setIsSubmitting(true);
    setSubmitError('');
    setServerErrors({});
    setProblemIds([]);
    setTermsOutdated(false);
    setServerSaysUnverified(false);

    try {
      let target = pendingCheckout;
      if (!target) {
        const shippingAddress = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          streetAddress: form.streetAddress.trim(),
          suburb: form.suburb.trim(),
          city: form.city.trim(),
          province: form.province,
          postalCode: form.postalCode.trim(),
        };
        const { checkout, accessToken } = await createCheckout({
          items,
          shippingAddress,
          ...(isGuest ? { buyerEmail: form.email.trim(), acceptTerms: true } : {}),
        });
        storeCheckoutToken(checkout, accessToken);
        target = { id: checkout.id, token: accessToken };
        setPendingCheckout(target);
      }

      const payfast = await startCheckoutPayfast(target.id, target.token);
      // Why: the cart is emptied on the confirmation page once the checkout is actually paid, so a
      // cancelled or failed payment returns the buyer to a cart that still has their items.
      submitPayfastForm(payfast);
    } catch (err) {
      handleOrderError(err);
    }
  }

  if (items.length === 0 && !isSubmitting) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
        <p className="text-xl font-semibold text-slate-900">Your cart is empty</p>
        <Link href="/shop" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">
          Back to shop
        </Link>
      </div>
    );
  }

  /**
   * Why: One summary line, shared by every seller group and the cart fallback so the availability
   * flags and the fix-it actions look and behave identically wherever the line appears.
   * @param {object} item - A quote line (with `available`/`availableQuantity`) or a cart item.
   * @param {boolean} fromQuote - True for a quote line (adds price and availability issues).
   * @returns {JSX.Element} The list item.
   * @example
   * renderLine(quote.items[0], true);
   */
  function renderLine(item, fromQuote) {
    const image = fromQuote ? item.thumbnailUrl : item.primaryImage;
    const issue = fromQuote ? getQuoteLineIssue(item) : null;
    const isFlagged = Boolean(issue) || problemIds.includes(item.id);
    return (
      <li key={item.id} className="flex items-center gap-3">
        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {image ? (
            <img src={image} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[9px] font-semibold uppercase text-slate-400">No img</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
          {item.quantity > 1 && <p className="text-xs text-slate-500">Qty: {item.quantity}</p>}
          {isFlagged ? (
            <p className="text-xs text-red-500">
              {issue === 'reduced'
                ? `Only ${item.availableQuantity} available.`
                : 'No longer available. It is not included in the total.'}
            </p>
          ) : null}
          {issue === 'reduced' ? (
            <button type="button" onClick={() => updateQuantity(item.id, item.availableQuantity)} className="text-xs font-semibold text-slate-700 underline">
              Change quantity to {item.availableQuantity}
            </button>
          ) : null}
          {issue === 'unavailable' ? (
            <button type="button" onClick={() => removeItem(item.id)} className="text-xs font-semibold text-slate-700 underline">
              Remove from cart
            </button>
          ) : null}
        </div>
        <p className="text-sm font-semibold text-slate-900">{fromQuote ? formatRands(item.lineTotalCents) : ''}</p>
      </li>
    );
  }
  const renderQuoteLine = (item) => renderLine(item, true);
  const renderCartLine = (item) => renderLine(item, false);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Checkout</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Shipping details</h1>

      {needsEmailVerification ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Please verify your email address before you check out. Check your inbox for the verification link, or resend it from your <Link href="/profile" className="underline">profile</Link>.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">

          {/* ── Shipping form ── */}
          <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Delivery address</h2>

            {/* Name row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" name="firstName" value={form.firstName} error={touched.firstName && errors.firstName} onChange={handleChange} onBlur={handleBlur} required />
              <Field label="Last name" name="lastName" value={form.lastName} error={touched.lastName && errors.lastName} onChange={handleChange} onBlur={handleBlur} required />
            </div>

            <Field label="Email address" name="email" type="email" value={form.email} error={touched.email && errors.email} onChange={handleChange} onBlur={handleBlur} placeholder="you@example.com" required />

            <Field label="Phone number" name="phone" type="tel" value={form.phone} error={touched.phone && errors.phone} onChange={handleChange} onBlur={handleBlur} placeholder="+27 82 000 0000" required />
            <Field label="Street address" name="streetAddress" value={form.streetAddress} error={touched.streetAddress && errors.streetAddress} onChange={handleChange} onBlur={handleBlur} placeholder="123 Main Street" required />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Suburb" name="suburb" value={form.suburb} error={touched.suburb && errors.suburb} onChange={handleChange} onBlur={handleBlur} required />
              <Field label="City / Town" name="city" value={form.city} error={touched.city && errors.city} onChange={handleChange} onBlur={handleBlur} required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Province dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">Province <span className="text-red-500">*</span></label>
                <select
                  name="province"
                  value={form.province}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  className={`rounded-xl border px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00CED1] ${
                    touched.province && errors.province ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'
                  }`}
                >
                  <option value="">Select province</option>
                  {PROVINCES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                {touched.province && errors.province && (
                  <p className="text-xs text-red-500">{errors.province}</p>
                )}
              </div>

              <Field label="Postal code" name="postalCode" value={form.postalCode} error={touched.postalCode && errors.postalCode} onChange={handleChange} onBlur={handleBlur} placeholder="0001" maxLength={4} required />
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
                  <span>I have read and agree to the FastSport terms and conditions <span className="text-red-500">*</span></span>
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
                  {quote.unassignedItems.length > 0 ? (
                    <ul className="mt-4 space-y-3">{quote.unassignedItems.map(renderQuoteLine)}</ul>
                  ) : null}
                  {quote.sellers.map((group) => (
                    <div key={group.seller.id} className="mt-4 border-t border-slate-200 pt-4">
                      <p className="text-sm font-semibold text-slate-900">Seller: {group.seller.name}</p>
                      <ul className="mt-3 space-y-3">{group.items.map(renderQuoteLine)}</ul>
                      <div className="mt-3 space-y-1 text-sm text-slate-700">
                        <div className="flex justify-between"><span>Items</span><span>{formatRands(group.itemsCents)}</span></div>
                        {group.serviceFeeCents != null ? (
                          <div className="flex justify-between"><span>Service fee</span><span>{formatRands(group.serviceFeeCents)}</span></div>
                        ) : null}
                        <div className="flex justify-between"><span>Delivery</span><span>{formatRands(group.deliveryFeeCents)}</span></div>
                        <div className="flex justify-between font-semibold text-slate-900"><span>Seller total</span><span>{formatRands(group.totalCents)}</span></div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <ul className="mt-4 space-y-3">{items.map(renderCartLine)}</ul>
              )}
              {quoteError ? <p className="mt-3 text-xs text-red-500">{quoteError}</p> : null}
              <div className="mt-4 border-t border-slate-200 pt-4 space-y-2">
                <div className="flex justify-between text-base">
                  <span>Subtotal</span>
                  <span>{quote ? formatRands(quote.subtotalCents) : '…'}</span>
                </div>
                {quote?.serviceFeeCents != null ? (
                  <div className="flex justify-between text-base">
                    <span>Service fee</span>
                    <span>{formatRands(quote.serviceFeeCents)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-base">
                    <span>Delivery{quote ? ` (${quote.sellerCount} seller${quote.sellerCount === 1 ? '' : 's'})` : ''}</span>
                    <span>{quote ? formatRands(quote.deliveryFeeCents) : 'Calculating...'}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-slate-900 border-t border-slate-200 pt-2">
                  <span>Total</span>
                  <span>{quote ? formatRands(quote.totalCents) : '…'}</span>
                </div>
              </div>
                <p className="mt-2 text-xs text-slate-500">Your cart is split into one order per seller, paid in one payment. Delivery is charged per seller; multiple items from the same seller share one delivery fee.</p>
            </div>

            {submitError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {submitError}
                {termsOutdated ? <> <Link href="/profile" className="underline">Review the updated terms</Link>.</> : null}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isBlockedByQuote || needsEmailVerification}
              className="w-full rounded-full bg-[#00CED1] py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#00C5CD] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBlockedByQuote && (quoteLoading || !quote)
                ? 'Calculating delivery…'
                : (isSubmitting ? 'Processing…' : (pendingCheckout ? 'Retry payment' : 'Continue to payment'))}
            </button>

            <Link href="/shop" className="block text-center text-xs text-slate-500 hover:text-slate-700 underline">
              ← Back to shop
            </Link>
          </div>

        </div>
      </form>
    </div>
  );
}

function Field({ label, name, value, error, onChange, onBlur, type = 'text', placeholder = '', maxLength, required = false }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">{label} {required ? <span className="text-red-500">*</span> : null}</label>
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
