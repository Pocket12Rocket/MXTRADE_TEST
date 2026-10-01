import { apiRequest } from '@/lib/apiClient';

/**
 * Why: Sends the public contact form through the backend, which emails support with Reply-To set
 * to the visitor and rate-limits to 5 per 10 minutes per IP.
 * @param {{name: string, email: string, message: string}} form - Trimmed form values (name up to
 *   100 characters, message up to 2,000).
 * @returns {Promise<{message: string}>} Backend acknowledgement (202).
 * @throws {ApiProblemError} 422 for invalid fields, 429 `RATE_LIMITED` when over the limit.
 * @example
 * await sendContactMessage({ name: 'Sam', email: 'sam@example.com', message: 'Hi' });
 */
export function sendContactMessage({ name, email, message }) {
  return apiRequest('/contact', { method: 'POST', body: { name, email, message } });
}
