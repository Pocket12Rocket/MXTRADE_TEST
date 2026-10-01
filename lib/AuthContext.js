import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe, logout } from './api/auth';
import { reportError } from './userMessage';

const AuthContext = createContext(null);

/**
 * Why: Derives the small `user` identity object pages use for "is someone signed in" checks and
 * ids, from the backend's `Me` object. Kept separate from `profile` (the full `Me`).
 * @param {object|null} me - The backend `Me` object, or `null` when signed out.
 * @returns {{id: string, email: string, emailVerified: boolean}|null} The identity, or `null`.
 * @example
 * toUser({ id: 'u1', email: 'a@b.co', emailVerified: true }); // { id: 'u1', email: 'a@b.co', emailVerified: true }
 */
function toUser(me) {
  if (!me) {
    return null;
  }
  return { id: me.id, email: me.email, emailVerified: Boolean(me.emailVerified) };
}

/**
 * Why: Single source of the signed-in session for the whole app, so `GET /v1/me` is fetched once
 * and shared. Must be mounted above `CartProvider` in `pages/_app.js`.
 * @param {Object} props
 * @param {import('react').ReactNode} props.children - App subtree that can call `useAuth()`.
 * @returns {JSX.Element} A context provider wrapping `children`.
 * @example
 * <AuthProvider><CartProvider><Layout>{page}</Layout></CartProvider></AuthProvider>
 */
export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Why: Re-reads the signed-in user from the backend, e.g. after a change whose result isn't in
   * the response. Returns `null` (and clears state) when the session has ended.
   * @returns {Promise<object|null>} The fresh `Me` object, or `null` when signed out.
   * @throws {ApiProblemError} On server errors other than a signed-out 401.
   * @example
   * await refreshProfile();
   */
  const refreshProfile = useCallback(async () => {
    const me = await getMe();
    setProfile(me);
    return me;
  }, []);

  /**
   * Why: Stores a `Me` object the caller already has (login response, terms acceptance), so no
   * extra `/me` round trip is needed.
   * @param {object|null} me - The backend `Me` object, or `null`.
   * @returns {void}
   * @example
   * setSignedInUser(await login(email, password));
   */
  const setSignedInUser = useCallback((me) => {
    setProfile(me || null);
  }, []);

  /**
   * Why: Merges a known successful change into the shared profile without re-fetching, so every
   * consumer sees it immediately.
   * @param {Object} partial - Fields to merge into the current profile.
   * @returns {void}
   * @example
   * updateProfileLocal({ firstName: 'Jane' });
   */
  const updateProfileLocal = useCallback((partial) => {
    setProfile((current) => (current ? { ...current, ...partial } : current));
  }, []);

  /**
   * Why: Ends the backend session and clears in-memory user state, even if the network call
   * fails, so the UI never shows a signed-in user after sign-out.
   * @returns {Promise<void>}
   * @example
   * await signOut();
   */
  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch (err) {
      reportError('auth-logout', err);
    } finally {
      setProfile(null);
    }
  }, []);

  // Why: one session probe per page load. A failure (backend down, network) is treated as
  // signed out so `loading` can never stick at true.
  useEffect(() => {
    let active = true;
    getMe()
      .then((me) => {
        if (active) setProfile(me);
      })
      .catch((err) => {
        reportError('auth-session', err);
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const user = useMemo(() => toUser(profile), [profile]);

  const value = useMemo(
    () => ({ user, profile, loading, refreshProfile, updateProfileLocal, setSignedInUser, signOut }),
    [user, profile, loading, refreshProfile, updateProfileLocal, setSignedInUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Why: Internal accessor for the shared auth context — used by `lib/useAuth.js` (public hook),
 * `lib/cartContext.js`, and the few places that sign in or out (login page, Header).
 * @returns {{user: object|null, profile: object|null, loading: boolean, refreshProfile: Function, updateProfileLocal: Function, setSignedInUser: Function, signOut: Function}}
 * @throws {Error} If called outside an `AuthProvider`.
 * @example
 * const { user, signOut } = useAuthContext();
 */
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
