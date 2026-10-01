import { useRouter } from 'next/router';
import RefundRequestForm from './RefundRequestForm';

/**
 * Why: Signed-in buyer's refund page; the form itself is shared with the guest page.
 * @returns {JSX.Element} The refund form.
 * @example
 * // Rendered at /profile/orders/<orderId>/return
 * <ReturnOrderPage />
 */
export default function ReturnOrderPage() {
  const { orderId } = useRouter().query;
  return (
    <RefundRequestForm
      orderId={orderId}
      signedInDoneHref="/profile/orders"
      guestDoneHref="/profile/orders"
    />
  );
}
