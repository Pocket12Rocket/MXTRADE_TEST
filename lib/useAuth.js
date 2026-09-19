import { useAuthContext } from './AuthContext';

/**
 * Why: Public auth hook used throughout `pages/` and `components/`. Historically each
 * call mounted its own `onAuthStateChanged` listener and re-read `users/{uid}`
 * independently (see docs/TECH_DEBT.md PERF-06/BUG-04/ARCH-12); it now reads from the
 * single shared `AuthProvider` context (`lib/AuthContext.js`) instead, so the return
 * shape below is unchanged but the listener/read is shared app-wide.
 * @returns {{user: import('firebase/auth').User|null, profile: Object|null, loading: boolean, refreshProfile: Function}}
 *   Same 4 fields consumers already destructure today: `user`, `profile`, `loading`,
 *   and `refreshProfile` (an async re-read of the signed-in user's profile).
 * @example
 * const { user, profile, loading, refreshProfile } = useAuth();
 */
export default function useAuth() {
  const { user, profile, loading, refreshProfile } = useAuthContext();
  return { user, profile, loading, refreshProfile };
}
