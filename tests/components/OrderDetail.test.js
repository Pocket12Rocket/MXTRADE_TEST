import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrderDetail from '../../components/OrderDetail';
import { confirmDelivery } from '../../lib/api/returns';

vi.mock('../../lib/api/returns', () => ({ confirmDelivery: vi.fn() }));

const BASE = {
  id: 'abcdef12-3456-7890-abcd-ef1234567890',
  status: 'delivered',
  statusLabel: 'Delivered',
  items: [{ name: 'Trail Shoes', quantity: 1, unitPriceCents: 129950, lineTotalCents: 129950 }],
  itemsCents: 119950,
  serviceFeeCents: 10000,
  subtotalCents: 129950,
  deliveryFeeCents: 0,
  totalCents: 129950,
  canConfirmDelivery: false,
  canRequestRefund: false,
  canReportNotArrived: false,
  notArrivedReportableFrom: null,
};

const renderOrder = (overrides) => render(<OrderDetail order={{ ...BASE, ...overrides }} refundHref="/order/x/return" />);

beforeEach(() => {
  vi.mocked(confirmDelivery).mockReset();
});

describe('OrderDetail totals', () => {
  it('shows items, service fee, delivery and total as separate lines', () => {
    renderOrder({ deliveryFeeCents: 5000, totalCents: 134950 });

    expect(screen.getByText('Items R1199.50')).toBeTruthy();
    expect(screen.getByText('Service fee R100.00')).toBeTruthy();
    expect(screen.getByText('Delivery R50.00')).toBeTruthy();
    expect(screen.getByText('R1349.50')).toBeTruthy();
  });
});

describe('OrderDetail refund states', () => {
  const DENIED = { id: 'r1', type: 'damaged', status: 'denied', reason: 'Cracked', adminResponse: 'Not covered', images: [], createdAt: '2026-10-01T10:00:00Z' };

  it('shows a denied request and still offers the actions the flags allow', () => {
    renderOrder({ refund: DENIED, canRequestRefund: true, canConfirmDelivery: true, refundDeadline: '2099-01-05T00:00:00Z' });

    expect(screen.getByText('Denied')).toBeInTheDocument();
    expect(screen.getByText('Our response: Not covered')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request refund' })).toHaveAttribute('href', '/order/x/return');
    expect(screen.getByRole('button', { name: 'Confirm delivery' })).toBeInTheDocument();
  });

  it('offers Report not arrived again after a denied never_arrived request', () => {
    renderOrder({ status: 'shipped', refund: { ...DENIED, type: 'never_arrived' }, canReportNotArrived: true });

    expect(screen.getByText('Denied')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Report not arrived' })).toBeInTheDocument();
  });

  it('keeps refund_pending before delivery on the Shipped step', () => {
    renderOrder({ status: 'refund_pending', statusLabel: 'Refund pending', shippedAt: '2026-09-20T10:00:00Z', deliveredAt: null, refund: { ...DENIED, type: 'never_arrived', status: 'pending' } });

    expect(screen.getByText('Under review')).toBeInTheDocument();
    expect(screen.getAllByText('Current')).toHaveLength(1);
    expect(screen.getByText('Shipped').parentElement).toHaveTextContent('Current');
  });
});

describe('OrderDetail returns actions', () => {
  it('hides every action when no flag is set', () => {
    renderOrder();

    expect(screen.queryByRole('button', { name: 'Confirm delivery' })).not.toBeInTheDocument();
    expect(screen.queryByText('Request refund')).not.toBeInTheDocument();
    expect(screen.queryByText('Report not arrived')).not.toBeInTheDocument();
  });

  it('shows the refund link only for canRequestRefund, with the deadline', () => {
    renderOrder({ canRequestRefund: true, refundDeadline: '2026-10-03T10:00:00Z' });

    expect(screen.getByRole('link', { name: 'Request refund' })).toHaveAttribute('href', '/order/x/return');
    expect(screen.getByText(/You can request a refund until/)).toBeInTheDocument();
  });

  it('links Report not arrived to the never_arrived form', () => {
    renderOrder({ status: 'shipped', canReportNotArrived: true });

    expect(screen.getByRole('link', { name: 'Report not arrived' })).toHaveAttribute('href', '/order/x/return?type=never_arrived');
  });

  it('tells the buyer when a missing parcel can be reported', () => {
    renderOrder({ status: 'shipped', notArrivedReportableFrom: '2099-01-05T00:00:00Z' });

    expect(screen.getByText(/You can report a missing parcel from/)).toBeInTheDocument();
    expect(screen.queryByText('Report not arrived')).not.toBeInTheDocument();
  });

  it('does not show the missing-parcel note for a delivered order', () => {
    renderOrder({ notArrivedReportableFrom: '2099-01-05T00:00:00Z' });

    expect(screen.queryByText(/You can report a missing parcel from/)).not.toBeInTheDocument();
  });

  it('confirms delivery after the warning step and shows the completed order', async () => {
    vi.mocked(confirmDelivery).mockResolvedValue({
      ...BASE,
      status: 'completed',
      statusLabel: 'Order complete',
      completedAt: '2026-10-01T10:00:00Z',
      completedBy: 'buyer',
    });
    renderOrder({ canConfirmDelivery: true });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delivery' }));
    expect(screen.getByText(/Problem refunds are no longer possible after this/)).toBeInTheDocument();
    expect(confirmDelivery).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, confirm delivery' }));

    await waitFor(() => expect(screen.getByText('Order complete')).toBeInTheDocument());
    expect(confirmDelivery).toHaveBeenCalledWith(BASE.id, '');
    expect(screen.getByText('You confirmed delivery.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm delivery' })).not.toBeInTheDocument();
  });

  it('shows the automatic completion on the Complete step', () => {
    renderOrder({ status: 'completed', completedAt: '2026-10-01T10:00:00Z', completedBy: 'auto' });

    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Completed automatically 48 hours after delivery.')).toBeInTheDocument();
  });

  it('shows an error and keeps the button when confirming fails', async () => {
    vi.mocked(confirmDelivery).mockRejectedValue({ name: 'ApiProblemError', status: 409, code: 'ORDER_NOT_CONFIRMABLE', detail: 'This order can no longer be confirmed.' });
    renderOrder({ canConfirmDelivery: true });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delivery' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, confirm delivery' }));

    await waitFor(() => expect(screen.getByText('This order can no longer be confirmed.')).toBeInTheDocument());
  });
});
