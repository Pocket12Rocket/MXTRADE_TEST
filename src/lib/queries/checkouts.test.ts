import { describe, expect, it } from 'vitest';
import { ApiProblemError } from '@/lib/apiClient';
import {
  CHECKOUT_POLL_INTERVAL_MS,
  CHECKOUT_POLL_TIMEOUT_MS,
  getCheckoutPollInterval,
} from '@/lib/queries/checkouts';

const pending = { status: 'pending_payment', elapsedMs: 0, failures: 0, error: null } as const;

describe('getCheckoutPollInterval', () => {
  it('polls every 3 seconds while pending', () => {
    expect(getCheckoutPollInterval(pending)).toBe(CHECKOUT_POLL_INTERVAL_MS);
  });

  it('stops once the status settles', () => {
    expect(getCheckoutPollInterval({ ...pending, status: 'paid' as never })).toBe(false);
  });

  it('stops after 60 seconds', () => {
    expect(getCheckoutPollInterval({ ...pending, elapsedMs: CHECKOUT_POLL_TIMEOUT_MS - 1 })).toBe(
      CHECKOUT_POLL_INTERVAL_MS,
    );
    expect(getCheckoutPollInterval({ ...pending, elapsedMs: CHECKOUT_POLL_TIMEOUT_MS })).toBe(
      false,
    );
  });

  it('stops on a 429', () => {
    const error = new ApiProblemError({ status: 429 });
    expect(getCheckoutPollInterval({ ...pending, failures: 1, error })).toBe(false);
  });

  it('backs off after a failure and stops after three', () => {
    const error = new Error('boom');
    expect(getCheckoutPollInterval({ ...pending, failures: 1, error })).toBe(6000);
    expect(getCheckoutPollInterval({ ...pending, failures: 2, error })).toBe(12000);
    expect(getCheckoutPollInterval({ ...pending, failures: 3, error })).toBe(false);
  });
});
