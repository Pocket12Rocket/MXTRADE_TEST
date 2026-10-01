import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiProblemError } from '@/lib/apiClient';
import { getCheckout } from '@/lib/api/checkouts';
import type { Checkout } from '@/lib/api/types';
import {
  ORDER_POLL_INTERVAL_MS,
  ORDER_POLL_TIMEOUT_MS,
  useOrderStatusPoll,
} from './useOrderStatusPoll';

vi.mock('@/lib/api/checkouts', () => ({ getCheckout: vi.fn() }));

const pending = { id: 'c1', status: 'pending_payment' } as Checkout;
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe('useOrderStatusPoll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getCheckout).mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('polls until the checkout is paid', async () => {
    vi.mocked(getCheckout)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending)
      .mockResolvedValue({ id: 'c1', status: 'paid' } as Checkout);
    const { result } = renderHook(() => useOrderStatusPoll({ checkoutId: 'c1', token: 't' }));
    await advance(0);
    expect(result.current.polling).toBe(true);
    await advance(ORDER_POLL_INTERVAL_MS * 2);
    expect(getCheckout).toHaveBeenCalledTimes(3);
    expect(getCheckout).toHaveBeenCalledWith('c1', 't');
    expect(result.current.checkout?.status).toBe('paid');
    expect(result.current.polling).toBe(false);
    expect(result.current.timedOut).toBe(false);
    await advance(ORDER_POLL_INTERVAL_MS * 5);
    expect(getCheckout).toHaveBeenCalledTimes(3);
  });

  it('stops polling once the checkout has failed', async () => {
    vi.mocked(getCheckout)
      .mockResolvedValueOnce(pending)
      .mockResolvedValue({ id: 'c1', status: 'payment_failed' } as Checkout);
    const { result } = renderHook(() => useOrderStatusPoll({ checkoutId: 'c1' }));
    await advance(ORDER_POLL_INTERVAL_MS * 5);
    expect(getCheckout).toHaveBeenCalledTimes(2);
    expect(result.current.checkout?.status).toBe('payment_failed');
    expect(result.current.timedOut).toBe(false);
  });

  it('stops at the timeout while still pending', async () => {
    vi.mocked(getCheckout).mockResolvedValue(pending);
    const { result } = renderHook(() => useOrderStatusPoll({ checkoutId: 'c1' }));
    await advance(ORDER_POLL_TIMEOUT_MS + ORDER_POLL_INTERVAL_MS);
    const calls = vi.mocked(getCheckout).mock.calls.length;
    expect(result.current.polling).toBe(false);
    expect(result.current.timedOut).toBe(true);
    await advance(ORDER_POLL_INTERVAL_MS * 5);
    expect(getCheckout).toHaveBeenCalledTimes(calls);
  });

  it('stops on unmount', async () => {
    vi.mocked(getCheckout).mockResolvedValue(pending);
    const { unmount } = renderHook(() => useOrderStatusPoll({ checkoutId: 'c1' }));
    await advance(ORDER_POLL_INTERVAL_MS);
    const calls = vi.mocked(getCheckout).mock.calls.length;
    unmount();
    await advance(ORDER_POLL_INTERVAL_MS * 5);
    expect(getCheckout).toHaveBeenCalledTimes(calls);
  });

  it('does not fetch when disabled', async () => {
    renderHook(() => useOrderStatusPoll({ checkoutId: 'c1', enabled: false }));
    await advance(ORDER_POLL_INTERVAL_MS * 2);
    expect(getCheckout).not.toHaveBeenCalled();
  });

  it('stops polling on a 429 and keeps the last checkout', async () => {
    vi.mocked(getCheckout)
      .mockResolvedValueOnce(pending)
      .mockRejectedValue(new ApiProblemError({ status: 429 }));
    const { result } = renderHook(() => useOrderStatusPoll({ checkoutId: 'c1' }));
    await advance(ORDER_POLL_INTERVAL_MS * 10);
    expect(getCheckout).toHaveBeenCalledTimes(2);
    expect(result.current.polling).toBe(false);
    expect(result.current.checkout?.status).toBe('pending_payment');
  });
});
