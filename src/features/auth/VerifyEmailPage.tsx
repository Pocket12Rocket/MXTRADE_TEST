import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { resendVerification, verifyEmail } from '@/lib/api/auth';
import { toUserMessage } from '@/lib/userMessage';
import { useSingleFlight } from '@/lib/useSingleFlight';

// Why: The backend answers a resend request the same way whether or not the email needs
// verifying (no account enumeration, matching the pattern used elsewhere for auth flows), so the
// UI must show one generic sentence regardless of what actually happened server-side.
const RESEND_GENERIC_MESSAGE = "If an account needs verifying, we've sent a new link.";
const INVALID_LINK_MESSAGE = 'This link is invalid or has expired.';

/**
 * Why: Confirms a new account's email address from the link sent at signup. It calls
 * `verifyEmail()` exactly once (the token is single-use) and offers a resend when the link fails.
 * @returns The verifying/success/failure screen for `/verify-email?token=...`.
 * @example
 * // Rendered by Next.js for a visit to /verify-email?token=abc123
 * <VerifyEmail />
 */
export default function VerifyEmail() {
  const router = useRouter();
  const hasRunRef = useRef(false);
  const [verifyStatus, setStatus] = useState<'verifying' | 'success' | 'failure'>('verifying');
  const [email, setEmail] = useState('');
  const { run, pending: resending } = useSingleFlight();
  const [resendMessage, setResendMessage] = useState('');

  const token = typeof router.query.token === 'string' ? router.query.token : '';
  // Why: a link without a token can never verify, so it fails without a request.
  const status = router.isReady && !token ? 'failure' : verifyStatus;

  useEffect(() => {
    if (!router.isReady || !token || hasRunRef.current) {
      return;
    }
    hasRunRef.current = true;

    verifyEmail(token)
      .then(() => {
        setStatus('success');
      })
      .catch((err) => {
        console.error('[verify-email]', err?.code || err?.message || err);
        setStatus('failure');
      });
  }, [router.isReady, token]);

  /**
   * Why: Lets a user whose link expired or was already used request a fresh one without leaving
   * this page. Always shows the same generic sentence afterwards (win or lose) so this endpoint
   * can't be used to check whether an email address has an account.
   * @param event - The resend form's submit event.
   * @returns Resolves once the resend request settles.
   * @example
   * <form onSubmit={handleResend}>...</form>
   */
  const handleResend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      return;
    }

    setResendMessage('');
    try {
      await run(() => resendVerification(email.trim().toLowerCase()));
    } catch (err) {
      // Why: never surface the raw error to the user here — the message is generic either way,
      // but the detail is still worth logging for debugging.
      toUserMessage(err, RESEND_GENERIC_MESSAGE);
    } finally {
      setResendMessage(RESEND_GENERIC_MESSAGE);
    }
  };

  if (status === 'verifying') {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(0,197,205,0.16),_transparent_45%),linear-gradient(135deg,_#f8fafc_0%,_#ffffff_55%,_#f0fdfa_100%)] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md rounded-[2rem] border border-slate-200 bg-white/95 p-8 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00C5CD]/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-[#00C5CD]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Account</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">
                Verifying your email...
              </h1>
              <p className="mt-3 text-slate-600">Hold on a moment while we confirm your link.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(0,197,205,0.16),_transparent_45%),linear-gradient(135deg,_#f8fafc_0%,_#ffffff_55%,_#f0fdfa_100%)] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md rounded-[2rem] border border-slate-200 bg-white/95 p-8 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00C5CD]/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-[#00C5CD]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Account</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">Email verified</h1>
              <p className="mt-3 text-slate-600">Your email is verified. You can now log in.</p>
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-[#00C5CD]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V7.5a4.5 4.5 0 00-9 0v3M6.75 10.5h10.5a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5v-6a1.5 1.5 0 011.5-1.5z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Account</p>
            <h1 className="text-2xl font-semibold text-slate-900">Link expired</h1>
          </div>
        </div>
        <p className="mt-5 text-slate-600">{INVALID_LINK_MESSAGE}</p>
        <form onSubmit={handleResend} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="verify-email-email"
              className="block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="verify-email-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 w-full focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={resending}
            className="w-full rounded-3xl bg-[#00C5CD] px-4 py-3 font-medium text-white transition hover:bg-[#00CED1] disabled:opacity-60"
          >
            {resending ? 'Sending...' : 'Send a new link'}
          </button>
        </form>
        {resendMessage ? <p className="mt-4 text-sm text-slate-500">{resendMessage}</p> : null}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 text-center">
          Already verified?{' '}
          <Link href="/login" className="font-semibold text-[#00C5CD] hover:text-[#00CED1]">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
