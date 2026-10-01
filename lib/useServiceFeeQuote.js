import { useEffect, useState } from 'react';
import { fetchServiceFeeQuote } from './api/submissions';
import { randsToCents } from './api/catalog';

// Why: wait for the seller to stop typing before asking the backend, so one price does not cost
// one request per keystroke.
export const SERVICE_FEE_QUOTE_DEBOUNCE_MS = 400;

/**
 * Why: Powers the live "buyers pay R..." preview on the seller forms. The backend owns the service fee
 * rules, so the client never calculates the buyer price itself; it asks
 * `GET /pricing/service-fee-quote` after a short pause in typing.
 * @param {string|number} price - The seller's own price in rands, as typed.
 * @returns {{sellerPriceCents: number, serviceFeeCents: number, listPriceCents: number, markupPercent: number}|null} The
 *   quote for the current price, or null while the price is empty, invalid or being fetched.
 * @example
 * const quote = useServiceFeeQuote(form.price);
 * // quote && `Buyers pay R${centsToRands(quote.listPriceCents).toFixed(2)}`
 */
export function useServiceFeeQuote(price) {
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    const cents = randsToCents(price);
    if (!Number.isFinite(cents) || cents <= 0) {
      setQuote(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      fetchServiceFeeQuote(cents)
        .then((result) => {
          if (!cancelled) setQuote(result);
        })
        // Why: the preview is a convenience; the backend still prices the listing on submit, so a
        // failed quote just hides the preview instead of showing an error.
        .catch(() => {
          if (!cancelled) setQuote(null);
        });
    }, SERVICE_FEE_QUOTE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [price]);

  return quote;
}
