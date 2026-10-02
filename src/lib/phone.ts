/** South African mobile numbers are 9 digits once the leading 0 is dropped (+27 82 123 4567). */
export const ZA_PHONE_DIGITS = 9;

// Why: matches the backend's PhoneSchema (6–15 digits) for every other country.
const MIN_PHONE_DIGITS = 6;
const MAX_PHONE_DIGITS = 15;

/**
 * Why: Keeps the phone field to digits only as the user types; for South Africa it drops the
 * trunk 0 people habitually type (082…) and stops at 9 digits.
 * @param value - The raw input value.
 * @param countryIso - The selected country's ISO code, e.g. `ZA`.
 * @returns The cleaned digits.
 * @example
 * sanitizePhoneInput('082 123 4567', 'ZA'); // '821234567'
 */
export function sanitizePhoneInput(value: string, countryIso: string): string {
  const digits = value.replace(/\D/g, '');
  if (countryIso === 'ZA') {
    return digits.replace(/^0/, '').slice(0, ZA_PHONE_DIGITS);
  }
  return digits.slice(0, MAX_PHONE_DIGITS);
}

/**
 * Why: The sentence to show under the phone field, or '' when the number is acceptable. The
 * number is optional, so an empty value is fine.
 * @param phone - The sanitized phone digits.
 * @param countryIso - The selected country's ISO code, e.g. `ZA`.
 * @returns The error message, or ''.
 * @example
 * getPhoneError('82123', 'ZA'); // 'Enter the 9 digits of your mobile number, e.g. 821234567.'
 */
export function getPhoneError(phone: string, countryIso: string): string {
  if (!phone) {
    return '';
  }
  if (countryIso === 'ZA') {
    return new RegExp(`^\\d{${ZA_PHONE_DIGITS}}$`).test(phone)
      ? ''
      : 'Enter the 9 digits of your mobile number, e.g. 821234567.';
  }
  return phone.length >= MIN_PHONE_DIGITS && phone.length <= MAX_PHONE_DIGITS
    ? ''
    : `Enter a valid phone number (${MIN_PHONE_DIGITS}–${MAX_PHONE_DIGITS} digits).`;
}
