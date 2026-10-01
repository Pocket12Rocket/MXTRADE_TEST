import { formatServiceFeeLabel } from '../lib/api/catalog';

/**
 * Why: Shows the "incl. R... service fee" line under an all-in price, and nothing when the fee is
 * zero or missing, so every listing names the fee the same way.
 * @param {object} props - Component props.
 * @param {number} [props.serviceFee] - Per-unit service fee in rands.
 * @param {string} [props.className] - Classes for the label.
 * @returns {JSX.Element|null} The label, or null when there is no fee.
 * @example
 * <ServiceFeeNote serviceFee={product.serviceFee} className="text-xs text-slate-500" />
 */
export default function ServiceFeeNote({ serviceFee, className = 'text-xs text-slate-500' }) {
  const label = formatServiceFeeLabel(serviceFee);
  return label ? <p className={className}>({label})</p> : null;
}
