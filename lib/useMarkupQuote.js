import { useEffect, useState } from 'react';
import { fetchMarkupQuote } from './api/submissions';
import { randsToCents } from './api/catalog';

// Why: wait for the seller to stop typing before asking the backend, so one price does not cost
// one request per keystroke.
export const MARKUP_QUOTE_DEBOUNCE_MS = 400;

/**
 * Why: Powers the live "buyers pay R..." preview on the seller forms. The backend owns the markup
 * rules (D-04), so the client never calculates the buyer price itself; it asks
 * `GET /pricing/markup-quote` after a short pause in typing.
 * @param {string|number} price - The seller's own price in rands, as typed.
 * @returns {{sellerPriceCents: number, listPriceCents: number, markupPercent: number}|null} The
 *   quote for the current price, or null while the price is empty, invalid or being fetched.
 * @example
 * const quote = useMarkupQuote(form.price);
 * // quote && `Buyers pay R ${centsToRands(quote.listPriceCents).toFixed(2)}`
 */
export function useMarkupQuote(price) {
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    const cents = randsToCents(price);
    if (!Number.isFinite(cents) || cents <= 0) {
      setQuote(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      fetchMarkupQuote(cents)
        .then((result) => {
          if (!cancelled) setQuote(result);
        })
        // Why: the preview is a convenience; the backend still prices the listing on submit, so a
        // failed quote just hides the preview instead of showing an error.
        .catch(() => {
          if (!cancelled) setQuote(null);
        });
    }, MARKUP_QUOTE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [price]);

  return quote;
}
