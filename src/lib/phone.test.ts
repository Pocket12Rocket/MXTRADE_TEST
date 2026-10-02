import { describe, expect, it } from 'vitest';
import { getPhoneError, sanitizePhoneInput } from './phone';

describe('sanitizePhoneInput', () => {
  it('keeps digits only, drops the South African trunk 0 and stops at 9 digits', () => {
    expect(sanitizePhoneInput('082 123-4567', 'ZA')).toBe('821234567');
    expect(sanitizePhoneInput('8212345678', 'ZA')).toBe('821234567');
    expect(sanitizePhoneInput('abc', 'ZA')).toBe('');
  });

  it('keeps a leading 0 and allows up to 15 digits for other countries', () => {
    expect(sanitizePhoneInput('0201 234 5678', 'US')).toBe('02012345678');
    expect(sanitizePhoneInput('1234567890123456789', 'DE')).toBe('123456789012345');
  });
});

describe('getPhoneError', () => {
  it('accepts an empty number because the field is optional', () => {
    expect(getPhoneError('', 'ZA')).toBe('');
  });

  it('requires exactly 9 digits for South Africa', () => {
    expect(getPhoneError('821234567', 'ZA')).toBe('');
    expect(getPhoneError('82123456', 'ZA')).toMatch(/9 digits/);
  });

  it('requires 6 to 15 digits for other countries', () => {
    expect(getPhoneError('2025550123', 'US')).toBe('');
    expect(getPhoneError('12345', 'US')).toMatch(/6–15 digits/);
  });
});
