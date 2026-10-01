import { useState } from 'react';
import { formatRands } from '../lib/api/orders';
import { SERVICE_FEE_WAIVED_LABEL, randsToCents } from '../lib/api/catalog';
import { useServiceFeeQuote } from '../lib/useServiceFeeQuote';

/**
 * Why: Shows the seller what buyers will pay for the price they typed, with the explanatory
 * tooltip. Both seller forms use it; the amounts come from the backend's service fee quote, not
 * from client-side maths.
 * @param {object} props - Component props.
 * @param {string} props.price - The seller's own price in rands, as typed.
 * @param {boolean} [props.serviceFeeWaived] - True on a fee-free listing: buyers pay the seller price.
 * @returns {JSX.Element|null} The preview line, or null until a quote is available.
 * @example
 * <SellingPriceInfo price={form.price} />
 */
export default function SellingPriceInfo({ price, serviceFeeWaived = false }) {
  const [show, setShow] = useState(false);
  // Why: a fee-free listing has no fee to quote, so the buyer price is the seller price.
  const fetched = useServiceFeeQuote(serviceFeeWaived ? '' : price);
  const cents = randsToCents(price);
  const quote = serviceFeeWaived
    ? (Number.isFinite(cents) && cents > 0 ? { sellerPriceCents: cents, listPriceCents: cents, serviceFeeCents: 0 } : null)
    : fetched;

  if (!quote) return null;

  return (
    <div className="flex items-center gap-2 mt-1 text-xs text-red-600">
      <span>
        You receive {formatRands(quote.sellerPriceCents)}. Buyers pay {formatRands(quote.listPriceCents)}{serviceFeeWaived ? `. ${SERVICE_FEE_WAIVED_LABEL}.` : `, including the ${formatRands(quote.serviceFeeCents)} FastSport service fee.`}
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
            The buyer price includes the FastSport service fee. This is the final amount the buyer will pay for the item, excluding delivery.<br /><br />
            The price you enter is the amount you will receive from the sale.
          </span>
        )}
      </span>
    </div>
  );
}
