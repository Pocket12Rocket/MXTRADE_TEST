import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckoutPage from './CheckoutPage';
import { createCheckout, quoteCheckout, startCheckoutPayfast } from '@/lib/api/checkouts';

const CART = [{ id: 'p1', name: 'Helmet', quantity: 1, price: 100 }];
const QUOTE = {
  items: [{ id: 'p1', name: 'Helmet', quantity: 1, available: true, availableQuantity: 3 }],
  sellers: [
    {
      seller: { id: 's1', name: 'Ann' },
      items: [{ id: 'p1', name: 'Helmet', quantity: 1, available: true, availableQuantity: 3 }],
      itemsCents: 10000,
      serviceFeeCents: 0,
      deliveryFeeCents: 5000,
      totalCents: 15000,
    },
  ],
  itemsCents: 10000,
  serviceFeeCents: 0,
  deliveryFeeCents: 5000,
  totalCents: 15000,
  sellerCount: 1,
};

// Why: the page re-fills the form whenever `user` or `profile` change identity, so the mock must return stable objects.
const AUTH = {
  user: { email: 'sam@example.com', emailVerified: true },
  profile: {
    firstName: 'Sam',
    lastName: 'Buyer',
    phone: '0821234567',
    streetAddress: '1 Main Street',
    suburb: 'Sandton',
    city: 'Johannesburg',
    province: 'gauteng',
    postCode: '2000',
  },
};
vi.mock('@/lib/useAuth', () => ({ default: () => AUTH }));
vi.mock('@/features/cart/cartContext', () => ({
  useCart: () => ({ items: CART, removeItem: vi.fn(), updateQuantity: vi.fn() }),
}));
vi.mock('@/lib/api/checkouts', () => ({
  createCheckout: vi.fn(),
  quoteCheckout: vi.fn(),
  startCheckoutPayfast: vi.fn(),
}));
vi.mock('@/lib/api/orders', async (importOriginal) => ({
  ...(await importOriginal()),
  storeCheckoutToken: vi.fn(),
  submitPayfastForm: vi.fn(),
}));

beforeEach(() => {
  quoteCheckout.mockReset().mockResolvedValue(QUOTE);
  createCheckout.mockReset().mockReturnValue(new Promise(() => {}));
  startCheckoutPayfast.mockReset();
});

describe('CheckoutPage double submit', () => {
  it('creates the checkout once for two rapid submits', async () => {
    const { container } = render(<CheckoutPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeEnabled(),
    );

    const form = container.querySelector('form');
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(createCheckout).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Processing…' })).toBeDisabled();
  });
});
