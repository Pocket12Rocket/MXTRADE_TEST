import { useRouter } from 'next/router';
import RefundRequestForm from '../../../components/RefundRequestForm';

/**
 * Why: Refund page for guests arriving from the emailed order link. The form sends the order
 * token stored on the order page; afterwards a guest returns to the guest order page and a
 * signed-in buyer to their profile order.
 * @returns {JSX.Element} The refund form.
 * @example
 * // Rendered at /order/<orderId>/return
 * <GuestReturnOrderPage />
 */
export default function GuestReturnOrderPage() {
  const { orderId } = useRouter().query;
  return (
    <RefundRequestForm
      orderId={orderId}
      signedInDoneHref={`/profile/orders/${orderId}`}
      guestDoneHref={`/order/${orderId}`}
    />
  );
}
