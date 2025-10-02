import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserByUid } from '../services/api';

interface ExtendedUser extends User {
  customDisplayName?: string;
  points?: number;
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
            customDisplayName: dbUser?.display_name || dbUser?.displayName || user.displayName,
            points: dbUser?.points || 0
          } as ExtendedUser;
          
          console.log('🔍 User data merge:', {
            firebaseDisplayName: user.displayName,
            databaseDisplayName: dbUser?.display_name,
            finalDisplayName: extendedUser.customDisplayName
          });
          
          setCurrentUser(extendedUser);
        } catch (error) {
          console.log('No database user found, creating user in database...');
          try {
            // Import createOrUpdateUser function
            const { createOrUpdateUser } = await import('../services/api');
            
            // Create user in database
            const newDbUser = await createOrUpdateUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
            });
            
            console.log('✅ User created in database:', newDbUser);
            
            // Merge Firebase user with database user data
            const extendedUser = {
              ...user,
              customDisplayName: newDbUser?.display_name || newDbUser?.displayName || user.displayName,
              points: newDbUser?.points || 0
            } as ExtendedUser;
            
            setCurrentUser(extendedUser);
          } catch (createError) {
            console.log('Failed to create user in database, using Firebase user only');
            setCurrentUser(user as ExtendedUser);
          }
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