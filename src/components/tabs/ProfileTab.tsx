// my-app/src/components/tabs/ProfileTab.tsx

import React, { useState, useEffect } from 'react';
import {
  User, Award, BarChart3, Wallet, Info, ChevronRight, Edit2, Camera, Lock, X, Check, Moon, Sun
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCommuterLevel, getLevelProgress } from '../../utils/commuterLevel';
import { getUserByUid, getUserTripStats } from '../../services/api';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../../config/firebase';

// Type definitions
interface Setting {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
}


interface ProfileTabProps {
  userPoints: number;
}

interface UserData {
  points: number;
  display_name?: string;
  email?: string;
}

interface TripStats {
  total_trips: number;
  total_distance: number;
  total_saved: number;
  total_points: number;
  completed_trips: number;
}

// Theme colors based on logo
const theme = {
  primary: '#2B5F88',
  primaryDark: '#1E4463',
  primaryLight: '#3B7FB8',
  secondary: '#4A90C2',
  accent: '#5BA3D5',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
};

// ==================== PROFILE TAB ====================
const ProfileTab: React.FC<ProfileTabProps> = ({ userPoints }) => {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [tripStats, setTripStats] = useState<TripStats>({
    total_trips: 0,
    total_distance: 0,
    total_saved: 0,
    total_points: 0,
    completed_trips: 0
  });
  const [, setLoading] = useState(true);

  // Edit profile states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editType, setEditType] = useState<'name' | 'password' | 'photo' | null>(null);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        // Fetch user data from database
        const userDataResponse = await getUserByUid(currentUser.uid);
        setUserData(userDataResponse);

        // Fetch trip stats
        const statsData = await getUserTripStats(currentUser.uid, 'month');
        setTripStats(statsData);
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser]);

  // Apply dark mode to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    showToast(`Dark mode ${!darkMode ? 'enabled' : 'disabled'}`, 'success');
  };

  // Use database points if available, otherwise fall back to prop
  const actualUserPoints = userData?.points ?? userPoints;

  // Calculate commuter level and progress
  const commuterLevel = getCommuterLevel(actualUserPoints);
  const levelProgress = getLevelProgress(actualUserPoints);

  // Handle profile photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !currentUser) return;

    const file = e.target.files[0];
    setUploading(true);

    try {
      // Get the actual Firebase auth user
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        showToast('Not authenticated', 'error');
        return;
      }

      // Upload to Firebase Storage
      const storageRef = ref(storage, `profile-photos/${currentUser.uid}`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);

      // Update Firebase Auth profile
      await updateProfile(firebaseUser, { photoURL });

      // Show success toast
      showToast('Profile photo updated!', 'success');

      // Reload page to reflect changes
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error uploading photo:', error);
      showToast('Failed to upload photo', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Handle display name update
  const handleUpdateDisplayName = async () => {
    if (!currentUser || !newDisplayName.trim()) return;

    setUpdating(true);
    try {
      // Get the actual Firebase auth user
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        showToast('Not authenticated', 'error');
        return;
      }

      await updateProfile(firebaseUser, { displayName: newDisplayName });
      showToast('Name updated successfully!', 'success');
      setShowEditModal(false);
      setNewDisplayName('');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error updating name:', error);
      showToast('Failed to update name', 'error');
    } finally {
      setUpdating(false);
    }
  };

  // Handle password update
  const handleUpdatePassword = async () => {
    if (!currentUser || !currentUser.email) return;

    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    setUpdating(true);
    try {
      // Get the actual Firebase auth user
      const firebaseUser = auth.currentUser;
      if (!firebaseUser || !firebaseUser.email) {
        showToast('Not authenticated', 'error');
        return;
      }

      // Re-authenticate user first
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);

      // Update password
      await updatePassword(firebaseUser, newPassword);

      showToast('Password updated successfully!', 'success');
      setShowEditModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/wrong-password') {
        showToast('Current password is incorrect', 'error');
      } else {
        showToast('Failed to update password', 'error');
      }
    } finally {
      setUpdating(false);
    }
  };

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 z-50 animate-slide-in';
    toast.innerHTML = `
      <div class="bg-gradient-to-r ${type === 'success' ? 'from-green-500 to-emerald-600' : 'from-red-500 to-red-600'} text-white rounded-2xl shadow-2xl p-4 max-w-md">
        <p class="text-sm font-medium">${message}</p>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  const settings: Setting[] = [
    { icon: Info, label: 'About', value: 'v1.0.2' }
  ];

  return (
    <div className="space-y-4">
      {/* User Profile Header */}
      <div className="rounded-2xl p-6 text-white"
           style={{background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`}}>
        <div className="flex items-center space-x-4">
          <div className="relative w-20 h-20">
            <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'Profile'}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <User className="h-10 w-10" />
              )}
            </div>
            {currentUser && (
              <label className="absolute bottom-0 right-0 w-7 h-7 bg-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <Camera className="h-4 w-4" style={{ color: theme.primary }} />
              </label>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold">
              {currentUser ? ((currentUser as any).customDisplayName || currentUser.displayName || currentUser.email) : 'Guest User'}
            </h2>
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{commuterLevel.icon}</span>
              <p className="text-blue-100" style={{ color: commuterLevel.color }}>
                Commuter Level: {commuterLevel.name}
              </p>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Award className="h-5 w-5 text-yellow-300" />
              <span className="font-semibold">{actualUserPoints} Points</span>
            </div>
            
            {/* Level Progress Bar */}
            {levelProgress.nextLevel && (
              <div className="mt-3">
                <div className="flex justify-between text-sm text-blue-100 mb-1">
                  <span>Progress to {levelProgress.nextLevel.name}</span>
                  <span>{levelProgress.pointsToNext} points to go</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${levelProgress.progressPercentage}%`,
                      backgroundColor: commuterLevel.color 
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Commute Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 transition-colors">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Commute Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl p-4 text-center dark:bg-gray-700 transition-colors" style={{ backgroundColor: `${theme.primary}10` }}>
            <BarChart3 className="h-8 w-8 mx-auto mb-2" color={theme.primary} />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{tripStats.total_trips}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Trips this month</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-4 text-center transition-colors">
            <Wallet className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">₱{Math.round(tripStats.total_saved)}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Money saved</p>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 transition-colors">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Settings</h3>
        <div className="space-y-3">
          {currentUser && (
            <>
              <button
                onClick={() => {
                  setEditType('name');
                  setNewDisplayName(currentUser.displayName || '');
                  setShowEditModal(true);
                }}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all"
              >
                <div className="flex items-center space-x-3">
                  <Edit2 className="h-5 w-5" style={{ color: theme.primary }} />
                  <span className="font-medium text-gray-900 dark:text-white">Edit Display Name</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </button>

              {/* Only show password change for email/password users (not Google sign-in) */}
              {currentUser.providerData.some(provider => provider.providerId === 'password') && (
                <button
                  onClick={() => {
                    setEditType('password');
                    setShowEditModal(true);
                  }}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <Lock className="h-5 w-5" style={{ color: theme.primary }} />
                    <span className="font-medium text-gray-900 dark:text-white">Change Password</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                </button>
              )}
            </>
          )}

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all"
          >
            <div className="flex items-center space-x-3">
              {darkMode ? (
                <Sun className="h-5 w-5" style={{ color: theme.warning }} />
              ) : (
                <Moon className="h-5 w-5" style={{ color: theme.primary }} />
              )}
              <span className="font-medium text-gray-900 dark:text-white">Dark Mode</span>
            </div>
            <div className="flex items-center space-x-2">
              <div
                className="relative w-12 h-6 rounded-full transition-colors cursor-pointer"
                style={{ backgroundColor: darkMode ? theme.primary : '#D1D5DB' }}
              >
                <div
                  className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform"
                  style={{ transform: darkMode ? 'translateX(24px)' : 'translateX(0)' }}
                />
              </div>
            </div>
          </button>

          {settings.map((setting, i) => (
            <button
              key={i}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all"
            >
              <div className="flex items-center space-x-3">
                <setting.icon className="h-5 w-5" style={{ color: theme.primary }} />
                <span className="font-medium text-gray-900 dark:text-white">{setting.label}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{setting.value}</span>
                <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {editType === 'name' ? 'Edit Display Name' : 'Change Password'}
                </h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditType(null);
                    setNewDisplayName('');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {editType === 'name' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Display Name
                      </label>
                      <input
                        type="text"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter new display name"
                      />
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setShowEditModal(false);
                          setEditType(null);
                          setNewDisplayName('');
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdateDisplayName}
                        disabled={updating || !newDisplayName.trim()}
                        className="flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                        style={{ backgroundColor: theme.primary }}
                      >
                        {updating ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            <span>Save</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Current Password
                      </label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter current password"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter new password (min 6 characters)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Confirm new password"
                      />
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setShowEditModal(false);
                          setEditType(null);
                          setCurrentPassword('');
                          setNewPassword('');
                          setConfirmPassword('');
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdatePassword}
                        disabled={updating || !currentPassword || !newPassword || !confirmPassword}
                        className="flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                        style={{ backgroundColor: theme.primary }}
                      >
                        {updating ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Updating...</span>
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            <span>Update Password</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileTab;