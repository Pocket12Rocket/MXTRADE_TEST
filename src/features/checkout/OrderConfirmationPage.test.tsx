import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderConfirmationPage from './OrderConfirmationPage';
import { cancelCheckout, getCheckout } from '@/lib/api/checkouts';
import { getOrderToken } from '@/lib/api/orders';
import type { Checkout } from '@/lib/api/types';

const replace = vi.fn();
const clearCart = vi.fn();
const routerState = { isReady: true, pathname: '/order/confirmation', query: {}, replace };
const authState = { user: null };

vi.mock('next/router', () => ({ useRouter: () => routerState }));
vi.mock('@/lib/useAuth', () => ({ default: () => authState }));
vi.mock('@/features/cart/cartContext', () => ({ useCart: () => ({ clearCart }) }));
vi.mock('@/lib/api/checkouts', () => ({ getCheckout: vi.fn(), cancelCheckout: vi.fn() }));

const checkout = {
  id: 'c1',
  status: 'paid',
  orders: [
    { id: 'o1', status: 'paid', statusLabel: 'Paid', seller: { name: 'Ann' } },
    {
      id: 'o2',
      status: 'late_payment',
      statusLabel: 'Payment under review',
      seller: { name: 'Bob' },
    },
  ],
} as unknown as Checkout;

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(getCheckout).mockReset().mockResolvedValue(checkout);
  vi.mocked(cancelCheckout)
    .mockReset()
    .mockResolvedValue(null as never);
  replace.mockReset();
  clearCart.mockReset();
  routerState.isReady = true;
  routerState.query = { checkoutId: 'c1' };
  authState.user = null;
});

describe('OrderConfirmationPage', () => {
  it('stores the emailed token, strips it from the URL and loads the checkout with it', async () => {
    routerState.query = { checkoutId: 'c1', token: 'tok-1' };

    render(<OrderConfirmationPage />);

    expect(await screen.findByText(/Ann: Paid/)).toBeInTheDocument();
    expect(getCheckout).toHaveBeenCalledWith('c1', 'tok-1');
    expect(replace).toHaveBeenCalledWith(
      { pathname: '/order/confirmation', query: { checkoutId: 'c1' } },
      undefined,
      { shallow: true },
    );
    expect(getOrderToken('c1')).toBe('tok-1');
    await waitFor(() => {
      expect(getOrderToken('o1')).toBe('tok-1');
      expect(getOrderToken('o2')).toBe('tok-1');
    });
  });

  it('reads the stored token on the PayFast return, with nothing to strip', async () => {
    sessionStorage.setItem('fastsport_order_token_c1', 'stored');

    render(<OrderConfirmationPage />);

    expect(await screen.findByText(/Ann: Paid/)).toBeInTheDocument();
    expect(getCheckout).toHaveBeenCalledWith('c1', 'stored');
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows the checkout as under review when any order is late, and empties the cart', async () => {
    render(<OrderConfirmationPage />);

    expect(await screen.findByText(/Bob: Payment under review/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Payment under review' })).toBeInTheDocument();
    expect(clearCart).toHaveBeenCalled();
  });

  it('shows a fully paid checkout as placed', async () => {
    vi.mocked(getCheckout).mockResolvedValue({
      ...checkout,
      orders: [checkout.orders[0]],
    } as Checkout);

    render(<OrderConfirmationPage />);

    expect(await screen.findByText(/Ann: Paid/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Order placed!' })).toBeInTheDocument();
  });

  it('cancels the checkout with the stored token on a cancelled return', async () => {
    sessionStorage.setItem('fastsport_order_token_c1', 'stored');
    routerState.query = { checkoutId: 'c1', payment: 'cancelled' };

    render(<OrderConfirmationPage />);

    await waitFor(() => expect(cancelCheckout).toHaveBeenCalledWith('c1', 'stored'));
    expect(getCheckout).not.toHaveBeenCalled();
  });

  it('cancels the checkout only once under React Strict Mode', async () => {
    sessionStorage.setItem('fastsport_order_token_c1', 'stored');
    routerState.query = { checkoutId: 'c1', payment: 'cancelled' };

    render(
      <StrictMode>
        <OrderConfirmationPage />
      </StrictMode>,
    );

    await waitFor(() => expect(cancelCheckout).toHaveBeenCalledTimes(1));
  });
});
