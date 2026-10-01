import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { resetPassword } from '../lib/api/auth';
import { getFieldErrors } from '../lib/apiClient';
import { toUserMessage } from '../lib/userMessage';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const INVALID_LINK_MESSAGE = 'This reset link is invalid or has expired.';

/**
 * Why: Validates the new password client-side before spending a network round trip, matching the
 * backend's own 8–128 character rule (`resetPassword` in lib/api/auth.js) so the common case never
 * needs a server error to explain itself.
 * @param {string} password - The candidate new password.
 * @param {string} confirmPassword - The repeated password from the confirm field.
 * @returns {string} An empty string when valid, otherwise the message to show under the field.
 * @example
 * const message = validatePassword('short', 'short'); // 'Password must be 8-128 characters.'
 */
function validatePassword(password, confirmPassword) {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match.';
  }
  return '';
}

/**
 * Why: Lets a user set a new password from the link emailed by `forgotPassword()`. The success
 * screen says every device is signed out, and an invalid token offers a new link.
 * @returns {JSX.Element} The reset form, success screen, or invalid-link screen for
 *   `/reset-password?token=...`.
 * @example
 * // Rendered by Next.js for a visit to /reset-password?token=abc123
 * <ResetPassword />
 */
export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);

  const token = router.isReady && typeof router.query.token === 'string' ? router.query.token : '';
  const missingToken = router.isReady && !token;

  /**
   * Why: Runs the client-side length/match check first, then calls the backend, and maps a 422
   * `errors[]` response onto the `password` field via `getFieldErrors` per the backend contract,
   * so the user always sees one specific reason rather than a generic failure.
   * @param {React.FormEvent<HTMLFormElement>} event - The reset form's submit event.
   * @returns {Promise<void>} Resolves once the reset attempt settles.
   * @example
   * <form onSubmit={handleSubmit}>...</form>
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setFieldErrors({});

    const clientError = validatePassword(password, confirmPassword);
    if (clientError) {
      setFieldErrors({ password: clientError });
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      if (err?.code === 'AUTH_TOKEN_INVALID') {
        setTokenInvalid(true);
      } else {
        const errors = getFieldErrors(err);
        if (errors.password) {
          setFieldErrors({ password: errors.password });
        } else {
          setMessage(toUserMessage(err, 'We could not reset your password. Please try again.'));
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (missingToken || tokenInvalid) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(0,197,205,0.16),_transparent_45%),linear-gradient(135deg,_#f8fafc_0%,_#ffffff_55%,_#f0fdfa_100%)] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md rounded-[2rem] border border-slate-200 bg-white/95 p-8 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00C5CD]/10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#00C5CD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V7.5a4.5 4.5 0 00-9 0v3M6.75 10.5h10.5a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5v-6a1.5 1.5 0 011.5-1.5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Account</p>
              <h1 className="text-2xl font-semibold text-slate-900">Link expired</h1>
            </div>
          </div>
          <p className="mt-5 text-slate-600">{INVALID_LINK_MESSAGE}</p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 text-center">
            You can request a new one from <Link href="/login" className="font-semibold text-[#00C5CD] hover:text-[#00CED1]">the log in page</Link>.
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(0,197,205,0.16),_transparent_45%),linear-gradient(135deg,_#f8fafc_0%,_#ffffff_55%,_#f0fdfa_100%)] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md rounded-[2rem] border border-slate-200 bg-white/95 p-8 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00C5CD]/10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#00C5CD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
              </svg>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Account</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">Password updated</h1>
              <p className="mt-3 text-slate-600">
                Password updated. You&apos;ve been signed out on all devices — please log in with your new password.
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="mt-6 block w-full rounded-3xl bg-[#00C5CD] px-4 py-3 text-center font-medium text-white transition hover:bg-[#00CED1]"
          >
            Go to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(0,197,205,0.16),_transparent_45%),linear-gradient(135deg,_#f8fafc_0%,_#ffffff_55%,_#f0fdfa_100%)] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md rounded-[2rem] border border-slate-200 bg-white/95 p-8 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00C5CD]/10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#00C5CD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V7.5a4.5 4.5 0 00-9 0v3M6.75 10.5h10.5a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5v-6a1.5 1.5 0 011.5-1.5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Account</p>
            <h1 className="text-2xl font-semibold text-slate-900">Reset password</h1>
          </div>
        </div>
        <p className="mt-5 text-slate-600">Choose a new password for your account.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="reset-password-password" className="block text-sm font-medium text-slate-700">New password</label>
            <input
              id="reset-password-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 w-full focus:outline-none"
            />
            {fieldErrors.password ? <p className="mt-1 text-sm text-red-500">{fieldErrors.password}</p> : null}
          </div>
          <div>
            <label htmlFor="reset-password-confirm" className="block text-sm font-medium text-slate-700">Confirm password</label>
            <input
              id="reset-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              className="mt-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 w-full focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-3xl bg-[#00C5CD] px-4 py-3 font-medium text-white transition hover:bg-[#00CED1] disabled:opacity-60"
          >
            Update password
          </button>
        </form>
        {message ? <p className="mt-4 text-sm text-red-500">{message}</p> : null}
      </div>
    </div>
  );
}
