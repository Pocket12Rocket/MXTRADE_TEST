import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GuestOrderPage from './GuestOrderPage';
import { getOrder, getOrderToken, storeOrderToken } from '@/lib/api/orders';
import type { Order } from '@/lib/api/types';

const replace = vi.fn();
const routerState = { isReady: true, query: {}, replace };
const authState: { user: { id: string } | null; loading: boolean } = {
  user: null,
  loading: false,
};

vi.mock('next/router', () => ({
  useRouter: () => routerState,
}));

vi.mock('@/lib/useAuth', () => ({
  default: () => authState,
}));

vi.mock('@/lib/api/orders', async (importOriginal) => ({
  ...(await importOriginal()),
  getOrder: vi.fn(),
  getOrderToken: vi.fn(),
  storeOrderToken: vi.fn(),
  formatRands: (cents: number) => `R${(cents / 100).toFixed(2)}`,
}));

const order = {
  id: 'abcdef12-3456-7890-abcd-ef1234567890',
  status: 'paid',
  statusLabel: 'Paid',
  items: [{ name: 'Trail Shoes', quantity: 1, unitPriceCents: 129950, lineTotalCents: 129950 }],
  subtotalCents: 129950,
  deliveryFeeCents: 0,
  totalCents: 129950,
  canRequestRefund: false,
} as unknown as Order;

beforeEach(() => {
  vi.mocked(getOrder).mockReset();
  vi.mocked(getOrderToken).mockReset().mockReturnValue('');
  vi.mocked(storeOrderToken).mockReset();
  replace.mockReset();
  routerState.isReady = true;
  routerState.query = { orderId: order.id };
  authState.user = null;
  authState.loading = false;
});

describe('GuestOrderPage', () => {
  it('stores the emailed token, strips it from the URL and renders the order', async () => {
    routerState.query = { orderId: order.id, token: 'tok-1' };
    vi.mocked(getOrder).mockResolvedValue(order);

    render(<GuestOrderPage />);

    expect(await screen.findByText('Trail Shoes')).toBeInTheDocument();
    expect(storeOrderToken).toHaveBeenCalledWith(order.id, 'tok-1');
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(
      { pathname: '/order/[orderId]', query: { orderId: order.id } },
      `/order/${order.id}`,
      { shallow: true },
    );
    expect(getOrder).toHaveBeenCalledWith(order.id, 'tok-1');
  });

  it('uses the token already stored for this tab when the URL has none', async () => {
    vi.mocked(getOrderToken).mockReturnValue('stored');
    vi.mocked(getOrder).mockResolvedValue(order);

    render(<GuestOrderPage />);

    expect(await screen.findByText('Trail Shoes')).toBeInTheDocument();
    expect(getOrder).toHaveBeenCalledWith(order.id, 'stored');
    expect(replace).not.toHaveBeenCalled();
  });

  it('loads through the session for a signed-in buyer with no token', async () => {
    authState.user = { id: 'u1' };
    vi.mocked(getOrder).mockResolvedValue(order);

    render(<GuestOrderPage />);

    expect(await screen.findByText('Trail Shoes')).toBeInTheDocument();
    expect(getOrder).toHaveBeenCalledWith(order.id, '');
  });

  it('asks a visitor with no token and no session to open the emailed link', async () => {
    render(<GuestOrderPage />);

    expect(
      await screen.findByText('Open this order from the link in your email'),
    ).toBeInTheDocument();
    await waitFor(() => expect(getOrder).not.toHaveBeenCalled());
  });
});
