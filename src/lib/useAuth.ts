import { useAuthContext, type AuthContextValue } from './AuthContext';

/**
 * Why: Public auth hook used throughout `pages/` and `components/`. Reads the single shared
 * `AuthProvider` context (`lib/AuthContext.tsx`), which holds the backend session's `Me` object.
 * @returns `user` is the signed-in identity (or `null`), `profile` the full backend `Me` object,
 *   `loading` is true until the first session check finishes, and `refreshProfile` re-reads `/me`.
 * @example
 * const { user, profile, loading, refreshProfile } = useAuth();
 */
export default function useAuth(): Pick<
  AuthContextValue,
  'user' | 'profile' | 'loading' | 'refreshProfile'
> {
  const { user, profile, loading, refreshProfile } = useAuthContext();
  return { user, profile, loading, refreshProfile };
}
