import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { getFirebase, onAuthStateChanged, signOut as firebaseSignOut, isFirebaseConfigured } from '@/lib/firebase';
import { checkIsAdmin } from '@/lib/firestoreAdmin';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  adminCheckLoading: boolean;
  signOut: () => Promise<void>;
  firebaseConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      setAdminCheckLoading(false);
      return;
    }

    const { auth } = getFirebase();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      if (currentUser) {
        setAdminCheckLoading(true);
        try {
          const adminStatus = await checkIsAdmin(currentUser.uid);
          setIsAdmin(adminStatus);
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        } finally {
          setAdminCheckLoading(false);
        }
      } else {
        setIsAdmin(false);
        setAdminCheckLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    if (!isFirebaseConfigured) return;
    const { auth } = getFirebase();
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, adminCheckLoading, signOut, firebaseConfigured: isFirebaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
