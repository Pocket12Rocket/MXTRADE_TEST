import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getMe, logout } from '@/lib/api/auth';
import type { Me } from '@/lib/api/types';
import { reportError } from './userMessage';

/** The small signed-in identity pages use for "is someone signed in" checks and ids. */
export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

/** The value `AuthProvider` shares with every `useAuthContext()` caller. */
export interface AuthContextValue {
  user: AuthUser | null;
  /** The full backend `Me` object, or `null` when signed out. */
  profile: Me | null;
  /** True until the first session check finishes. */
  loading: boolean;
  refreshProfile: () => Promise<Me | null>;
  updateProfileLocal: (partial: Partial<Me>) => void;
  setSignedInUser: (me: Me | null | undefined) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Why: Derives the small `user` identity object pages use for "is someone signed in" checks and
 * ids, from the backend's `Me` object. Kept separate from `profile` (the full `Me`).
 * @param me - The backend `Me` object, or `null` when signed out.
 * @returns The identity, or `null`.
 * @example
 * toUser({ id: 'u1', email: 'a@b.co', emailVerified: true }); // { id: 'u1', email: 'a@b.co', emailVerified: true }
 */
function toUser(me: Me | null): AuthUser | null {
  if (!me) {
    return null;
  }
  return { id: me.id, email: me.email, emailVerified: Boolean(me.emailVerified) };
}

/**
 * Why: Single source of the signed-in session for the whole app, so `GET /v1/me` is fetched once
 * and shared. Must be mounted above `CartProvider` in `pages/_app.tsx`.
 * @param props
 * @param props.children - App subtree that can call `useAuth()`.
 * @returns A context provider wrapping `children`.
 * @example
 * <AuthProvider><CartProvider><Layout>{page}</Layout></CartProvider></AuthProvider>
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Why: Re-reads the signed-in user from the backend, e.g. after a change whose result isn't in
   * the response. Returns `null` (and clears state) when the session has ended.
   * @returns The fresh `Me` object, or `null` when signed out.
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
   * @param me - The backend `Me` object, or `null`.
   * @example
   * setSignedInUser(await login(email, password));
   */
  const setSignedInUser = useCallback((me: Me | null | undefined) => {
    setProfile(me || null);
  }, []);

  /**
   * Why: Merges a known successful change into the shared profile without re-fetching, so every
   * consumer sees it immediately.
   * @param partial - Fields to merge into the current profile.
   * @example
   * updateProfileLocal({ firstName: 'Jane' });
   */
  const updateProfileLocal = useCallback((partial: Partial<Me>) => {
    setProfile((current) => (current ? { ...current, ...partial } : current));
  }, []);

  /**
   * Why: Ends the backend session and clears in-memory user state, even if the network call
   * fails, so the UI never shows a signed-in user after sign-out.
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
    () => ({
      user,
      profile,
      loading,
      refreshProfile,
      updateProfileLocal,
      setSignedInUser,
      signOut,
    }),
    [user, profile, loading, refreshProfile, updateProfileLocal, setSignedInUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Why: Internal accessor for the shared auth context — used by `lib/useAuth.ts` (public hook),
 * `features/cart/cartContext.tsx`, and the few places that sign in or out (login page, Header).
 * @throws {Error} If called outside an `AuthProvider`.
 * @example
 * const { user, signOut } = useAuthContext();
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
