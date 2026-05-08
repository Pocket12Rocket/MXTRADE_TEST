import { useCallback, useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async (targetUser = null) => {
    const activeUser = targetUser || auth.currentUser;
    if (!activeUser) {
      setProfile(null);
      return null;
    }

    const userDoc = doc(db, 'users', activeUser.uid);
    const snapshot = await getDoc(userDoc);
    const nextProfile = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
    setProfile(nextProfile);
    return nextProfile;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('Auth state changed:', currentUser);
      if (!currentUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);
      await refreshProfile(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, [refreshProfile]);

  return { user, profile, loading, refreshProfile };
}
