import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { fetchUserProfileById } from './firestoreHelpers';

const AuthContext = createContext(null);

/**
 * Why: Centralizes Firebase auth state and the `users/{uid}` profile read behind a
 * single React context so every consumer (Header, Layout, CartProvider, pages) shares
 * one `onAuthStateChanged` listener and one profile read per sign-in, instead of each
 * `useAuth()` call mounting its own listener and re-fetching the same document
 * (see docs/TECH_DEBT.md PERF-06/BUG-04/ARCH-12). Must be mounted above `CartProvider`
 * in `pages/_app.js` so the cart can read auth from context too.
 * @param {Object} props
 * @param {import('react').ReactNode} props.children - App subtree that can call `useAuth()`.
 * @returns {JSX.Element} A context provider wrapping `children`.
 * @example
 * <AuthProvider><CartProvider><Layout>{page}</Layout></CartProvider></AuthProvider>
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Why: Provides an explicit, single re-read path for when a save's server-side
   * transformation (e.g. `serverTimestamp()`) means the local write payload can't be
   * trusted to reflect the stored document; kept intentionally rare (see
   * `updateProfileLocal` for the no-read alternative used after most profile saves).
   * @param {import('firebase/auth').User|null} [targetUser] - User to read the profile
   *   for; defaults to `auth.currentUser`.
   * @returns {Promise<Object|null>} The freshly read profile (or `null` if signed out
   *   or the `users/{uid}` doc doesn't exist).
   * @throws {FirebaseError} If the underlying Firestore read fails (e.g. permission-denied).
   * @example
   * await refreshProfile(); // re-read the signed-in user's own profile
   */
  const refreshProfile = useCallback(async (targetUser = null) => {
    const activeUser = targetUser || auth.currentUser;
    if (!activeUser) {
      setProfile(null);
      return null;
    }

    const nextProfile = await fetchUserProfileById(activeUser.uid);
    setProfile(nextProfile);
    return nextProfile;
  }, []);

  /**
   * Why: Lets callers reflect a successful write (whose payload is already known) into
   * the shared profile state without an extra `users/{uid}` read (PERF-18), and without
   * each page holding its own disconnected copy (BUG-04) — every consumer of this
   * context sees the update immediately.
   * @param {Object} partial - Fields to merge into the current profile.
   * @returns {void}
   * @example
   * updateProfileLocal({ firstName: 'Jane', lastName: 'Doe' });
   */
  const updateProfileLocal = useCallback((partial) => {
    setProfile((current) => (current ? { ...current, ...partial } : { ...partial }));
  }, []);

  // Why: One shared onAuthStateChanged listener for the whole app (was one per useAuth()
  // instance) — on sign-in, does exactly one users/{uid} read; on sign-out, clears the
  // in-memory profile cache per AGENTS.md ("must be cleared on logout"). The profile
  // read is wrapped in try/catch so a rejected getDoc (permission-denied, offline,
  // etc.) can't leave `loading` stuck at true or produce an unhandled rejection; on
  // failure the profile is treated as unknown (null) rather than left stale.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);
      try {
        await refreshProfile(currentUser);
      } catch (err) {
        setProfile(null);
        console.error('[AuthProvider] profile read failed', err?.code || err);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [refreshProfile]);

  const value = { user, profile, loading, refreshProfile, updateProfileLocal };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Why: Internal accessor for the shared auth context — used by `lib/useAuth.js` (public
 * hook, unchanged return shape) and by `lib/cartContext.js` (which needs `user`/`loading`
 * directly instead of running its own `onAuthStateChanged` listener).
 * @returns {{user: import('firebase/auth').User|null, profile: Object|null, loading: boolean, refreshProfile: Function, updateProfileLocal: Function}}
 * @throws {Error} If called outside an `AuthProvider`.
 * @example
 * const { user, profile } = useAuthContext();
 */
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
