import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { auth } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { createUserProfile } from '../lib/firestoreHelpers';

export default function Login() {
      // Handle confirm password change and blur
      const handleConfirmPasswordChange = (value) => {
        setConfirmPassword(value);
        if (passwordMismatchError && value === password) {
          setPasswordMismatchError('');
        }
      };

      const handleConfirmPasswordBlur = () => {
        if (confirmPassword && confirmPassword !== password) {
          setPasswordMismatchError('Passwords do not match.');
        } else {
          setPasswordMismatchError('');
        }
      };
    // Input classnames
    const defaultInputClass = "mt-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 w-full focus:outline-none";
    const requiredSignupInputClass = "mt-2 rounded-3xl border border-red-300 bg-red-50 px-4 py-3 w-full focus:outline-none";
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+27'); // Default to South Africa
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [passwordMismatchError, setPasswordMismatchError] = useState('');

  const countryCodes = [
    { cc: 'ZA', code: '+27', name: 'South Africa' },
    { cc: 'US', code: '+1', name: 'United States' },
    { cc: 'CA', code: '+1', name: 'Canada' },
    { cc: 'SA', code: '+966', name: 'Saudi Arabia' },
    { cc: 'QA', code: '+974', name: 'Qatar' },
    { cc: 'KH', code: '+855', name: 'Cambodia' },
    { cc: 'CN', code: '+86', name: 'China' },
    { cc: 'JP', code: '+81', name: 'Japan' },
    { cc: 'KR', code: '+82', name: 'South Korea' },
    { cc: 'SG', code: '+65', name: 'Singapore' },
    { cc: 'MY', code: '+60', name: 'Malaysia' },
    { cc: 'TH', code: '+66', name: 'Thailand' },
    { cc: 'ID', code: '+62', name: 'Indonesia' },
    { cc: 'PH', code: '+63', name: 'Philippines' },
    { cc: 'IN', code: '+91', name: 'India' },
    { cc: 'BD', code: '+880', name: 'Bangladesh' },
    { cc: 'PK', code: '+92', name: 'Pakistan' },
    { cc: 'FR', code: '+33', name: 'France' },
    { cc: 'DE', code: '+49', name: 'Germany' },
    { cc: 'IT', code: '+39', name: 'Italy' },
    { cc: 'ES', code: '+34', name: 'Spain' },
    { cc: 'NL', code: '+31', name: 'Netherlands' },
    { cc: 'BE', code: '+32', name: 'Belgium' },
    { cc: 'CH', code: '+41', name: 'Switzerland' },
    { cc: 'AT', code: '+43', name: 'Austria' },
    { cc: 'DK', code: '+45', name: 'Denmark' },
    { cc: 'SE', code: '+46', name: 'Sweden' },
    { cc: 'NO', code: '+47', name: 'Norway' },
  ];

  // ...existing hook logic and handlers...


  const countryCodeToFlag = (cc) => {
    const codePoints = cc.toUpperCase().split('').map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
  };

  // useEffect for message removed (no default info message)

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (mode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          await sendEmailVerification(userCredential.user);
          await auth.signOut();
          setPendingVerification(true);
          setMessage('Your account is not verified yet. We have sent a verification link to your email address.');
          return;
        }
        setMessage('Signed in successfully. Redirecting...');
        await router.push('/');
      } else {
        if (!firstName.trim() || !lastName.trim()) {
          setMessage('First name and last name are required.');
          return;
        }

        if (password !== confirmPassword) {
          setMessage('Passwords do not match. Please re-enter your password.');
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await createUserProfile(userCredential.user, 'customer', {
          firstName,
          lastName,
          phone,
          countryCode,
        });
        await sendEmailVerification(userCredential.user);
        await auth.signOut();
        setPendingVerification(true);
      }
    } catch (error) {
      if (
        error?.code === 'auth/invalid-credential' ||
        error?.code === 'auth/user-not-found' ||
        error?.code === 'auth/wrong-password'
      ) {
        setMessage('Incorrect email or password');
        return;
      }

      if (error?.code === 'auth/email-already-in-use') {
        setMode('login');
        setMessage('An account with this email address already exists. Please log in instead.');
        return;
      }

      if (error?.code === 'auth/invalid-email') {
        setMessage('Please enter a valid email address.');
        return;
      }

      if (error?.code === 'auth/weak-password') {
        setMessage('Password is too weak. Please use at least 6 characters.');
        return;
      }

      if (error?.code === 'auth/too-many-requests') {
        setMessage('Too many requests. Please wait a few minutes and try again.');
        return;
      }

      setMessage(error.message);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setMessage('');

    if (!email.trim()) {
      setMessage('Please enter your email address.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setResetSent(true);
        return;
      }

      const fallbackMessage = data?.message || 'We could not send the password reset email right now.';
      try {
        await sendPasswordResetEmail(auth, normalizedEmail, {
          url: `${window.location.origin}/login`,
          handleCodeInApp: false,
        });
        setResetSent(true);
      } catch (fallbackError) {
        const fallbackCode = fallbackError?.code || '';
        if (fallbackCode === 'auth/user-not-found' || fallbackCode === 'auth/invalid-credential' || fallbackCode === 'auth/missing-email') {
          setMessage('No account found with this email address.');
          return;
        }
        if (fallbackCode === 'auth/invalid-email') {
          setMessage('Please enter a valid email address.');
          return;
        }
        if (fallbackCode === 'auth/unauthorized-continue-uri') {
          setMessage('Password reset is currently blocked by your authentication domain settings. Please contact support for help.');
          return;
        }
        setMessage(fallbackMessage || fallbackError?.message || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      try {
        await sendPasswordResetEmail(auth, normalizedEmail, {
          url: `${window.location.origin}/login`,
          handleCodeInApp: false,
        });
        setResetSent(true);
      } catch (fallbackError) {
        const fallbackCode = fallbackError?.code || '';
        if (fallbackCode === 'auth/user-not-found' || fallbackCode === 'auth/invalid-credential' || fallbackCode === 'auth/missing-email') {
          setMessage('No account found with this email address.');
          return;
        }
        if (fallbackCode === 'auth/invalid-email') {
          setMessage('Please enter a valid email address.');
          return;
        }
        if (fallbackCode === 'auth/unauthorized-continue-uri') {
          setMessage('Password reset is currently blocked by your authentication domain settings. Please contact support for help.');
          return;
        }
        setMessage(error?.message || fallbackError?.message || 'Something went wrong. Please try again.');
      }
    }
  };

  const handleResendVerification = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      await auth.signOut();
      setMessage('Verification email resent. Please check your inbox.');
    } catch {
      setMessage('Could not resend verification email. Please try logging in again.');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // Optional: create user profile in Firestore if new user
      setMessage('Signed in with Google. Redirecting...');
      await router.push('/');
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (mode === 'forgot') {
    if (resetSent) {
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
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Password recovery</p>
                <h1 className="mt-2 text-2xl font-semibold text-slate-900">Check your inbox</h1>
                <p className="mt-3 text-slate-600">
                  We sent a secure reset link to <span className="font-medium text-slate-900">{email}</span>. Follow it to choose a new password.
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              If you don’t see the email within a few minutes, please check your spam or junk folder.
            </div>
            <button
              onClick={() => { setMode('login'); setResetSent(false); setMessage(''); }}
              className="mt-6 w-full rounded-3xl bg-[#00C5CD] px-4 py-3 font-medium text-white transition hover:bg-[#00CED1]"
            >
              Back to log in
            </button>
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
              <h1 className="text-2xl font-semibold text-slate-900">Forgot password</h1>
            </div>
          </div>
          <p className="mt-5 text-slate-600">Enter the email address linked to your account and we will send you a secure reset link.</p>
          <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className={defaultInputClass}
              />
            </div>
            <button className="w-full rounded-3xl bg-[#00C5CD] px-4 py-3 font-medium text-white transition hover:bg-[#00CED1]">
              Send reset link
            </button>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Need to sign in instead? <button type="button" onClick={() => { setMode('login'); setMessage(''); }} className="font-semibold text-[#00C5CD] hover:text-[#00CED1]">Return to log in</button>
            </div>
          </form>
          {message ? <p className="mt-4 text-sm text-red-500">{message}</p> : null}
        </div>
      </div>
    );
  }

  if (pendingVerification) {
    return (
      <div className="mx-auto max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00C5CD]/10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#00C5CD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Check your email</h1>
            <p className="mt-3 text-slate-600">
              We sent a verification link to <span className="font-medium text-slate-900">{email}</span>. Click the link in your email to activate your account, then come back to log in.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => { setPendingVerification(false); setMode('login'); }}
            className="w-full rounded-3xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-800"
          >
            Go to log in
          </button>
          <button
            type="button"
            onClick={handleResendVerification}
            className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50"
          >
            Resend verification email
          </button>
        </div>
        {message ? <p className="text-sm text-slate-500">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Account</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">{mode === 'login' ? 'Log in' : 'Register'}</h1>
        <p className="mt-3 text-slate-600">Create an account with your basic details. Selling access is enabled later from your profile.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className={mode === 'register' ? requiredSignupInputClass : defaultInputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className={mode === 'register' ? requiredSignupInputClass : defaultInputClass}
          />
        </div>
        {mode === 'register' ? (
          <div>
            <label className="block text-sm font-medium text-slate-700">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => handleConfirmPasswordChange(event.target.value)}
              onBlur={handleConfirmPasswordBlur}
              required
              className={requiredSignupInputClass}
            />
            {passwordMismatchError ? (
              <p className="mt-1 text-sm text-red-500">{passwordMismatchError}</p>
            ) : null}
          </div>
        ) : null}
        {mode === 'register' ? (
          <div>
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">Profile details</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Name</label>
                  <input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required={mode === 'register'}
                    className={requiredSignupInputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Surname</label>
                  <input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required={mode === 'register'}
                    className={requiredSignupInputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Contact number</label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(event) => setCountryCode(event.target.value)}
                    className="mt-2 rounded-3xl border border-slate-200 bg-slate-50 px-2 py-3 focus:outline-none"
                  >
                    {countryCodes.map((country) => (
                      <option key={`${country.code}-${country.name}`} value={country.code}>
                        {countryCodeToFlag(country.cc)} {country.code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="e.g. 821234567"
                    className="mt-2 flex-1 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500">Selling is not enabled during signup. You will complete a separate seller profile later if you want to list products.</p>
            </div>
          </div>
        ) : null}
        {mode === 'login' ? (
          <div className="text-right">
            <button type="button" onClick={() => { setMode('forgot'); setMessage(''); setPasswordMismatchError(''); }} className="text-sm text-[#00C5CD] hover:text-[#00CED1]">
              Forgot password?
            </button>
          </div>
        ) : null}
        <button className="w-full rounded-3xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-800">
          {mode === 'login' ? 'Log in' : 'Register'}
        </button>
        <p className="text-center text-sm text-slate-600">
          {mode === 'login' ? 'Need an account?' : 'Already have an account?'}{' '}
          <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage(''); setPasswordMismatchError(''); }} className="font-semibold text-[#00C5CD] hover:text-[#00CED1]">
            {mode === 'login' ? 'Register' : 'Log in'}
          </button>
        </p>
      </form>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
