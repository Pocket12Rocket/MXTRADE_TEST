import { SERVICE_FEE_WAIVED_LABEL, formatServiceFeeLabel } from '@/lib/api/catalog';

/**
 * Why: Shows the "incl. R... service fee" line under an all-in price, and nothing when the fee is
 * zero or missing, so every listing names the fee the same way.
 * @param {object} props - Component props.
 * @param {number} [props.serviceFee] - Per-unit service fee in rands.
 * @param {boolean} [props.waived] - True on a fee-free listing; shows the waived note instead.
 * @param {string} [props.className] - Classes for the label.
 * @returns {JSX.Element|null} The label, or null when there is no fee.
 * @example
 * <ServiceFeeNote serviceFee={product.serviceFee} className="text-xs text-slate-500" />
 */
export default function ServiceFeeNote({
  serviceFee,
  waived = false,
  className = 'text-xs text-slate-500',
}) {
  if (waived) return <p className={className}>{SERVICE_FEE_WAIVED_LABEL}</p>;
  const label = formatServiceFeeLabel(serviceFee);
  return label ? <p className={className}>({label})</p> : null;
}
