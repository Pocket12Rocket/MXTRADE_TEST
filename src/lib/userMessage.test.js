import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiProblemError } from './apiClient';
import { UserFacingError, toUserMessage } from './userMessage';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('toUserMessage', () => {
  it('shows UserFacingError text as-is', () => {
    expect(toUserMessage(new UserFacingError('Please add a photo.'), 'fallback')).toBe(
      'Please add a photo.',
    );
  });

  it('shows the backend detail for 4xx problems', () => {
    const error = new ApiProblemError({
      status: 409,
      code: 'OUT_OF_STOCK',
      detail: 'Only 1 left in stock.',
    });
    expect(toUserMessage(error, 'fallback')).toBe('Only 1 left in stock.');
  });

  it('uses the status sentence when a 4xx problem has no detail', () => {
    expect(toUserMessage(new ApiProblemError({ status: 429 }), 'fallback')).toMatch(
      /Too many requests/,
    );
  });

  it('maps AUTH_EMAIL_NOT_VERIFIED to a verify-your-email message', () => {
    const error = new ApiProblemError({ status: 403, code: 'AUTH_EMAIL_NOT_VERIFIED' });
    expect(toUserMessage(error, 'fallback')).toMatch(/verify your email/i);
  });

  it('never shows 503 detail text', () => {
    const error = new ApiProblemError({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      detail: 'PayFast not configured',
    });
    expect(toUserMessage(error, 'fallback')).toBe(
      'Something went wrong on our side. Please try again in a moment.',
    );
  });

  it('never shows 5xx text', () => {
    const error = new ApiProblemError({ status: 500, detail: 'db exploded at line 4' });
    expect(toUserMessage(error, 'fallback')).toBe(
      'Something went wrong on our side. Please try again in a moment.',
    );
  });

  it('maps fetch network failures to a connectivity message', () => {
    expect(toUserMessage(new TypeError('Failed to fetch'), 'fallback')).toMatch(/reach the server/);
  });

  it('falls back for unknown errors', () => {
    expect(toUserMessage(new Error('raw internals'), 'We could not save.')).toBe(
      'We could not save.',
    );
  });
});
