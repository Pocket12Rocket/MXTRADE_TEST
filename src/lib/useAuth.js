import { useAuthContext } from './AuthContext';

/**
 * Why: Public auth hook used throughout `pages/` and `components/`. Reads the single shared
 * `AuthProvider` context (`lib/AuthContext.js`), which holds the backend session's `Me` object.
 * @returns {{user: {id: string, email: string, emailVerified: boolean}|null, profile: Object|null, loading: boolean, refreshProfile: Function}}
 *   `user` is the signed-in identity (or `null`), `profile` the full backend `Me` object,
 *   `loading` is true until the first session check finishes, and `refreshProfile` re-reads `/me`.
 * @example
 * const { user, profile, loading, refreshProfile } = useAuth();
 */
export default function useAuth() {
  const { user, profile, loading, refreshProfile } = useAuthContext();
  return { user, profile, loading, refreshProfile };
}
