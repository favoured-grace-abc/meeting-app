import { useEffect, useMemo, useState } from 'react';
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
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn: async () => {
        await signInWithPopup(auth, googleProvider);
      },
      signOut: async () => {
        await firebaseSignOut(auth);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
