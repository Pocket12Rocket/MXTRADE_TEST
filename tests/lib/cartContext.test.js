import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CartProvider, useCart } from '../../lib/cartContext';

// Why: one stable auth value; a new `user` object per render would re-run the cart's
// hydration effect forever (the real AuthContext memoizes `user`).
vi.mock('../../lib/AuthContext', () => {
  const auth = { user: { id: 'u1' }, loading: false };
  return { useAuthContext: () => auth };
});

const wrapper = ({ children }) => <CartProvider>{children}</CartProvider>;

describe('cart addItem', () => {
  it('refuses a sold-out product (quantity 0)', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    let added;
    act(() => {
      added = result.current.addItem({ id: 'p1', name: 'Helmet', price: 100, quantity: 0 });
    });

    expect(added).toBe(false);
    expect(result.current.items).toHaveLength(0);
  });

  it('caps at stock and stores the thumbnail', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    const product = { id: 'p2', name: 'Gloves', price: 399, quantity: 1, primaryImage: 'full.webp', primaryThumbnail: 'thumb.webp' };

    act(() => {
      result.current.addItem(product);
    });
    let secondAdd;
    act(() => {
      secondAdd = result.current.addItem(product);
    });

    expect(secondAdd).toBe(false);
    expect(result.current.items).toEqual([expect.objectContaining({ id: 'p2', quantity: 1, primaryImage: 'thumb.webp' })]);
  });
});
