import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSingleFlight } from '../../lib/useSingleFlight';

/**
 * Why: Lets a test finish a pending async action on demand.
 * @returns {{promise: Promise<*>, resolve: Function, reject: Function}} A deferred promise.
 * @example
 * const deferred = createDeferred();
 */
function createDeferred() {
  const deferred = {};
  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
}

describe('useSingleFlight', () => {
  it('runs once for two synchronous calls and toggles pending', async () => {
    const { result } = renderHook(() => useSingleFlight());
    const deferred = createDeferred();
    const fn = vi.fn(() => deferred.promise);
    let first;
    let second;
    act(() => {
      first = result.current.run(fn);
      second = result.current.run(fn);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);
    await act(async () => {
      deferred.resolve('done');
      await first;
    });
    expect(await first).toBe('done');
    expect(await second).toBeUndefined();
    expect(result.current.pending).toBe(false);
    await act(async () => {
      await result.current.run(fn);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('releases the lock after an error', async () => {
    const { result } = renderHook(() => useSingleFlight());
    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('boom'))).catch(() => {});
    });
    expect(result.current.pending).toBe(false);
    const fn = vi.fn().mockResolvedValue(1);
    await act(async () => {
      await result.current.run(fn);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps the lock after success with holdOnSuccess', async () => {
    const { result } = renderHook(() => useSingleFlight());
    const fn = vi.fn().mockResolvedValue(1);
    await act(async () => {
      await result.current.run(fn, { holdOnSuccess: true });
    });
    expect(result.current.pending).toBe(true);
    await act(async () => {
      await result.current.run(fn);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('releases the lock after a failure even with holdOnSuccess', async () => {
    const { result } = renderHook(() => useSingleFlight());
    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('x')), { holdOnSuccess: true }).catch(() => {});
    });
    expect(result.current.pending).toBe(false);
  });
});
