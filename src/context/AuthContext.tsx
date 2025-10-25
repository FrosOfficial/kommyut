import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserByUid } from '../services/api';
import type { UserType } from '../types';

interface ExtendedUser extends User {
  customDisplayName?: string;
  points?: number;
  birthday?: string;
  userType?: UserType;
  idVerified?: boolean;
  fareId?: string; // 'F001' for regular, 'F002' for discounted
  farePrice?: number; // 13 for regular, 11 for discounted
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
          
          // Determine fare based on user type AND verification status
          const userType = (dbUser?.user_type || 'regular') as UserType;
          const isVerified = dbUser?.id_verified || false;
          // Only apply discount if user type is not regular AND ID is verified
          const fareId = (userType === 'regular' || !isVerified) ? 'F001' : 'F002';
          const farePrice = (userType === 'regular' || !isVerified) ? 13 : 11;

          // Merge Firebase user with database user data
          const extendedUser = {
            ...user,
            customDisplayName: dbUser?.display_name || dbUser?.displayName || user.displayName,
            points: dbUser?.points || 0,
            birthday: dbUser?.birthday,
            userType: userType,
            idVerified: dbUser?.id_verified || false,
            fareId: fareId,
            farePrice: farePrice
          } as ExtendedUser;

          console.log('🔍 User data merge:', {
            firebaseDisplayName: user.displayName,
            databaseDisplayName: dbUser?.display_name,
            finalDisplayName: extendedUser.customDisplayName,
            userType: extendedUser.userType,
            fareId: extendedUser.fareId,
            farePrice: extendedUser.farePrice
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

            // Determine fare based on user type AND verification status
            const userType = (newDbUser?.user_type || 'regular') as UserType;
            const isVerified = newDbUser?.id_verified || false;
            // Only apply discount if user type is not regular AND ID is verified
            const fareId = (userType === 'regular' || !isVerified) ? 'F001' : 'F002';
            const farePrice = (userType === 'regular' || !isVerified) ? 13 : 11;

            // Merge Firebase user with database user data
            const extendedUser = {
              ...user,
              customDisplayName: newDbUser?.display_name || newDbUser?.displayName || user.displayName,
              points: newDbUser?.points || 0,
              birthday: newDbUser?.birthday,
              userType: userType,
              idVerified: newDbUser?.id_verified || false,
              fareId: fareId,
              farePrice: farePrice
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