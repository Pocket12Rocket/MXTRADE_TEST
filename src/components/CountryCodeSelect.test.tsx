import { describe, expect, it } from 'vitest';
import { PHONE_COUNTRIES, findPhoneCountry, isoForDialCode } from './CountryCodeSelect';

describe('phone countries', () => {
  it('lists South Africa first and every country once', () => {
    expect(PHONE_COUNTRIES[0]!.iso).toBe('ZA');
    const isos = PHONE_COUNTRIES.map((country) => country.iso);
    expect(new Set(isos).size).toBe(isos.length);
  });

  it('maps a saved dialling code back to a country, defaulting to South Africa', () => {
    expect(isoForDialCode('+44')).toBe('GB');
    expect(isoForDialCode('+1')).toBe('US');
    expect(isoForDialCode('')).toBe('ZA');
    expect(isoForDialCode(null)).toBe('ZA');
  });

  it('finds a country by ISO code, falling back to South Africa', () => {
    expect(findPhoneCountry('CA').code).toBe('+1');
    expect(findPhoneCountry('XX').iso).toBe('ZA');
  });
});
