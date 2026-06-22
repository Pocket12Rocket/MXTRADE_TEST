import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useCart } from '../lib/cartContext';
import useAuth from '../lib/useAuth';
import { db } from '../lib/firebase';
import { fetchProductById } from '../lib/firestoreHelpers';

const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];

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

export default function CheckoutPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { items, totalPrice, clearCart } = useCart();
  const DELIVERY_FEE_PER_SELLER = 150;

  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [resolvedItems, setResolvedItems] = useState(items);
  const [isResolvingSellerInfo, setIsResolvingSellerInfo] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function resolveCartItems() {
      const itemsMissingSeller = items.filter((item) => !(item.sellerId || '').trim());
      if (itemsMissingSeller.length === 0) {
        if (isMounted) {
          setResolvedItems(items);
          setIsResolvingSellerInfo(false);
        }
        return;
      }

      if (isMounted) {
        setIsResolvingSellerInfo(true);
      }

      const resolved = await Promise.all(items.map(async (item) => {
        if ((item.sellerId || '').trim()) {
          return item;
        }

        try {
          const product = await fetchProductById(item.id);
          return {
            ...item,
            sellerId: product?.sellerId || '',
            sellerEmail: product?.sellerEmail || '',
          };
        } catch {
          return item;
        }
      }));

      if (isMounted) {
        setResolvedItems(resolved);
        setIsResolvingSellerInfo(false);
      }
    }

    resolveCartItems();

    return () => {
      isMounted = false;
    };
  }, [items]);

  const sellerKeys = Array.from(
    new Set(
      resolvedItems
        .map((item) => (item.sellerId || item.sellerEmail || '').trim())
        .filter(Boolean)
    )
  );
  const deliverySellerCount = sellerKeys.length;
  const deliveryFeeTotal = items.length === 0 ? 0 : (deliverySellerCount > 0 ? deliverySellerCount * DELIVERY_FEE_PER_SELLER : DELIVERY_FEE_PER_SELLER);
  const totalWithDelivery = totalPrice + deliveryFeeTotal;

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
      province: profile?.province || '',
      postalCode: profile?.postCode || profile?.postalCode || '',
    }));
  }, [user, profile]);

  const errors = Object.fromEntries(
    Object.entries(form).map(([key, val]) => [key, fieldError(key, val)])
  );
  const hasErrors = Object.values(errors).some(Boolean);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleBlur(event) {
    setTouched((prev) => ({ ...prev, [event.target.name]: true }));
  }

  function touchAll() {
    setTouched(Object.fromEntries(Object.keys(EMPTY_FORM).map((key) => [key, true])));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    touchAll();
    if (hasErrors) return;
    if (items.length === 0) return;
    if (isResolvingSellerInfo) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const buyerEmail = form.email.trim() || String(user?.email || '').trim();
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

      const sanitizedItems = resolvedItems.map((item) => ({
        productId: item.id,
        name: item.name,
        price: Number(item.price),
        quantity: Number(item.quantity),
        primaryImage: item.primaryImage || null,
        sellerId: item.sellerId || '',
        sellerEmail: item.sellerEmail || '',
      }));

      let orderId = '';

      try {
        const orderRes = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyerId: user ? user.uid : null,
            buyerEmail,
            items: resolvedItems,
            totalAmount: totalWithDelivery,
            shippingAddress,
            deliveryFee: deliveryFeeTotal,
            shippingSellerCount: deliverySellerCount,
          }),
        });

        const orderData = await orderRes.json();
        if (!orderRes.ok || !orderData.success || !orderData.orderId) {
          throw new Error(orderData.error || 'Could not create order.');
        }

        orderId = orderData.orderId;
      } catch (orderError) {
        const message = String(orderError?.message || '');
        const shouldTryGuestFallback = !user && /missing or insufficient permissions/i.test(message);

        if (!shouldTryGuestFallback) {
          throw orderError;
        }

        // Fallback: guest checkout can create a pending order directly via rules.
        const guestOrderRef = await addDoc(collection(db, 'orders'), {
          buyerId: null,
          buyerEmail,
          items: sanitizedItems,
          totalAmount: Number(totalWithDelivery),
          shippingAddress,
          deliveryFee: Number(deliveryFeeTotal),
          shippingSellerCount: deliverySellerCount,
          status: 'pending_payment',
          createdAt: serverTimestamp(),
        });
        orderId = guestOrderRef.id;
      }

      const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const guestReturnUrl = siteOrigin ? `${siteOrigin}/order/confirmation?orderId=${orderId}` : undefined;

      // Call Payfast checkout API
      const pfRes = await fetch('/api/payfast/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalWithDelivery,
          item_name: `Order #${orderId}`,
          item_description: items.map((i) => i.name).join(', '),
          email_address: buyerEmail,
          custom_str1: orderId,
          return_url: user ? undefined : guestReturnUrl,
          cancel_url: user ? undefined : guestReturnUrl,
        }),
      });
      const pfData = await pfRes.json();
      if (pfData.success && pfData.redirectUrl) {
        clearCart();
        window.location.href = pfData.redirectUrl;
        return;
      } else {
        setSubmitError(pfData.error || 'Could not initiate Payfast payment.');
        setIsSubmitting(false);
        return;
      }
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
      setIsSubmitting(false);
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Checkout</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">Shipping details</h1>

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
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {touched.province && errors.province && (
                  <p className="text-xs text-red-500">{errors.province}</p>
                )}
              </div>

              <Field label="Postal code" name="postalCode" value={form.postalCode} error={touched.postalCode && errors.postalCode} onChange={handleChange} onBlur={handleBlur} placeholder="0001" maxLength={4} required />
            </div>
          </div>

          {/* ── Order summary ── */}
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Order summary</h2>
              <ul className="mt-4 space-y-3">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3">
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {item.primaryImage ? (
                        <img src={item.primaryImage} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[9px] font-semibold uppercase text-slate-400">No img</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                      {item.quantity > 1 && <p className="text-xs text-slate-500">Qty: {item.quantity}</p>}
                    </div>
                    <p className="text-sm font-semibold text-slate-900">R{(item.price * item.quantity).toFixed(2)}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-slate-200 pt-4 space-y-2">
                <div className="flex justify-between text-base">
                  <span>Subtotal</span>
                  <span>R{totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base">
                    <span>Delivery ({deliverySellerCount || 1} seller{(deliverySellerCount || 1) === 1 ? '' : 's'})</span>
                    <span>{isResolvingSellerInfo ? 'Calculating...' : `R${deliveryFeeTotal.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-slate-900 border-t border-slate-200 pt-2">
                  <span>Total</span>
                  <span>R{totalWithDelivery.toFixed(2)}</span>
                </div>
              </div>
                <p className="mt-2 text-xs text-slate-500">Nationwide delivery is charged at R150 per seller in the cart. Multiple items from the same seller share one delivery fee.</p>
            </div>

            {submitError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isResolvingSellerInfo}
              className="w-full rounded-full bg-[#00CED1] py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#00C5CD] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isResolvingSellerInfo ? 'Calculating delivery…' : (isSubmitting ? 'Processing…' : 'Continue to payment')}
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
