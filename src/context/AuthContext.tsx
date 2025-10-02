import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserByUid } from '../services/api';

interface ExtendedUser extends User {
  customDisplayName?: string;
}

interface AuthContextType {
  currentUser: ExtendedUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ currentUser: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Try to get user data from database
          const dbUser = await getUserByUid(user.uid);
          console.log('🔍 Database user data:', dbUser);
          
          // Merge Firebase user with database user data
          const extendedUser = {
            ...user,
            customDisplayName: dbUser?.display_name || dbUser?.displayName || user.displayName
          } as ExtendedUser;
          
          console.log('🔍 User data merge:', {
            firebaseDisplayName: user.displayName,
            databaseDisplayName: dbUser?.display_name,
            finalDisplayName: extendedUser.customDisplayName
          });
          
          setCurrentUser(extendedUser);
        } catch (error) {
          console.log('No database user found, using Firebase user only');
          setCurrentUser(user as ExtendedUser);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};