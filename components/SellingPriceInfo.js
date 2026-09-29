import { useState } from 'react';
import { centsToRands } from '../lib/api/catalog';
import { useMarkupQuote } from '../lib/useMarkupQuote';

/**
 * Why: Shows the seller what buyers will pay for the price they typed, with the explanatory
 * tooltip. Both seller forms use it; the amount comes from the backend's markup quote (D-04), not
 * from client-side maths.
 * @param {object} props - Component props.
 * @param {string} props.price - The seller's own price in rands, as typed.
 * @returns {JSX.Element|null} The preview line, or null until a quote is available.
 * @example
 * <SellingPriceInfo price={form.price} />
 */
export default function SellingPriceInfo({ price }) {
  const [show, setShow] = useState(false);
  const quote = useMarkupQuote(price);

  if (!quote) return null;

  return (
    <div className="flex items-center gap-2 mt-1 text-xs text-red-600">
      <span>
        Buyers pay: R {centsToRands(quote.listPriceCents).toFixed(2)}
      </span>
      <span className="relative flex items-center">
        <span
          tabIndex={0}
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer border border-slate-300 hover:bg-slate-300 focus:bg-slate-300 focus:outline-none"
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
          onFocus={() => setShow(true)}
          onBlur={() => setShow(false)}
        >
          ?
        </span>
        {show && (
          <span
            className="absolute left-6 top-1 z-10 w-64 rounded-lg bg-white border border-slate-300 p-3 text-xs text-slate-700 shadow-lg"
          >
            The selling price includes the Fast Sport transaction fee. This is the final amount the buyer will pay, excluding shipping costs.<br /><br />
            The price entered by you (the seller) is the amount you will receive from the sale.
          </span>
        )}
      </span>
    </div>
  );
}
