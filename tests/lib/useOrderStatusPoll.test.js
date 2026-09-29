import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrder } from '../../lib/api/orders';
import { ORDER_POLL_INTERVAL_MS, ORDER_POLL_TIMEOUT_MS, useOrderStatusPoll } from '../../lib/useOrderStatusPoll';

vi.mock('../../lib/api/orders', () => ({ getOrder: vi.fn() }));

const pending = { id: 'o1', status: 'pending_payment' };
const advance = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('useOrderStatusPoll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getOrder.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('polls until the order is paid', async () => {
    getOrder.mockResolvedValueOnce(pending).mockResolvedValueOnce(pending).mockResolvedValue({ id: 'o1', status: 'paid' });
    const { result } = renderHook(() => useOrderStatusPoll({ orderId: 'o1', token: 't' }));
    await advance(0);
    expect(result.current.polling).toBe(true);
    await advance(ORDER_POLL_INTERVAL_MS * 2);
    expect(getOrder).toHaveBeenCalledTimes(3);
    expect(getOrder).toHaveBeenCalledWith('o1', 't');
    expect(result.current.order.status).toBe('paid');
    expect(result.current.polling).toBe(false);
    expect(result.current.timedOut).toBe(false);
    await advance(ORDER_POLL_INTERVAL_MS * 5);
    expect(getOrder).toHaveBeenCalledTimes(3);
  });

  it('stops at the timeout while still pending', async () => {
    getOrder.mockResolvedValue(pending);
    const { result } = renderHook(() => useOrderStatusPoll({ orderId: 'o1' }));
    await advance(ORDER_POLL_TIMEOUT_MS + ORDER_POLL_INTERVAL_MS);
    const calls = getOrder.mock.calls.length;
    expect(result.current.polling).toBe(false);
    expect(result.current.timedOut).toBe(true);
    await advance(ORDER_POLL_INTERVAL_MS * 5);
    expect(getOrder).toHaveBeenCalledTimes(calls);
  });

  it('stops on unmount', async () => {
    getOrder.mockResolvedValue(pending);
    const { unmount } = renderHook(() => useOrderStatusPoll({ orderId: 'o1' }));
    await advance(ORDER_POLL_INTERVAL_MS);
    const calls = getOrder.mock.calls.length;
    unmount();
    await advance(ORDER_POLL_INTERVAL_MS * 5);
    expect(getOrder).toHaveBeenCalledTimes(calls);
  });

  it('does not fetch when disabled', async () => {
    renderHook(() => useOrderStatusPoll({ orderId: 'o1', enabled: false }));
    await advance(ORDER_POLL_INTERVAL_MS * 2);
    expect(getOrder).not.toHaveBeenCalled();
  });

  it('stops polling on a 429 and keeps the last order', async () => {
    getOrder.mockResolvedValueOnce(pending).mockRejectedValue(Object.assign(new Error('slow down'), { status: 429 }));
    const { result } = renderHook(() => useOrderStatusPoll({ orderId: 'o1' }));
    await advance(ORDER_POLL_INTERVAL_MS * 10);
    expect(getOrder).toHaveBeenCalledTimes(2);
    expect(result.current.polling).toBe(false);
    expect(result.current.order.status).toBe('pending_payment');
  });
});
