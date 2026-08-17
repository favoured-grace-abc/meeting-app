import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  auth,
  googleProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from '../services/firebase';
import { AuthContext } from './authContext';
import type { User } from 'firebase/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    onAuthStateChanged(auth, (nextUser) => {
      if (cancelled) return;
      setUser(nextUser);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    const result = await signInWithPopup(auth, googleProvider);
    setUser(result.user);
    return result.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn,
      signOut: async () => {
        await firebaseSignOut(auth);
      },
    }),
    [user, loading, signIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
