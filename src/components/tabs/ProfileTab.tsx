import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Settings, Camera, Edit2, Moon, Sun, Save, X, Lock, Trophy } from 'lucide-react';
import { updateProfile, updatePassword } from 'firebase/auth';
import { auth } from '../../config/firebase';
import * as api from '../../services/api';
import { getCommuterLevel, getLevelProgress } from '../../utils/commuterLevel';
import LoginPrompt from '../common/LoginPrompt';

const ProfileTab: React.FC = () => {
  const { currentUser } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(currentUser?.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState(currentUser?.photoURL || '');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [userPoints, setUserPoints] = useState(0);

  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser) return;

      try {
        const userData = await api.getUserByUid(currentUser.uid);
        setUserPoints(userData.points || 0);
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();

    // Auto-refresh user points every 5 seconds to show updates from completed trips
    const intervalId = setInterval(() => {
      if (currentUser) {
        loadUserData();
      }
    }, 5000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [currentUser]);

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);

    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleUpdateDisplayName = async () => {
    if (!currentUser || !newDisplayName.trim()) return;

    try {
      await updateProfile(currentUser, {
        displayName: newDisplayName.trim()
      });

      setSuccessMessage('Display name updated successfully!');
      setIsEditingName(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update display name');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentUser) return;

    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    try {
      await updatePassword(currentUser, newPassword);
      setSuccessMessage('Password updated successfully!');
      setIsEditingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        setErrorMessage('Please log out and log in again before changing your password');
      } else {
        setErrorMessage(error.message || 'Failed to update password');
      }
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Image must be less than 2MB');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setErrorMessage('File must be an image');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    setIsUploadingImage(true);

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        try {
          await updateProfile(currentUser, {
            photoURL: base64String
          });

          setProfileImageUrl(base64String);
          setSuccessMessage('Profile picture updated successfully!');
          setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error: any) {
          setErrorMessage(error.message || 'Failed to update profile picture');
          setTimeout(() => setErrorMessage(''), 3000);
        } finally {
          setIsUploadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      setErrorMessage('Failed to read image file');
      setTimeout(() => setErrorMessage(''), 3000);
      setIsUploadingImage(false);
    }
  };

  if (!currentUser) {
    return (
      <LoginPrompt
        icon={User}
        title="Profile"
        description="Manage your account and preferences"
        gradientFrom="from-indigo-500"
        gradientTo="to-blue-600"
        onLoginClick={() => {
          // Trigger login modal from header
          document.querySelector<HTMLButtonElement>('[data-login-button]')?.click();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 animate-fadeIn">
          <p className="text-green-600 dark:text-green-400 font-medium">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 animate-fadeIn">
          <p className="text-red-600 dark:text-red-400 font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Profile Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl transition-all duration-300 hover:shadow-2xl">
        <div className="flex items-center space-x-4">
          <div className="relative">
            {currentUser.photoURL || profileImageUrl ? (
              <img
                src={profileImageUrl || currentUser.photoURL || ''}
                alt={currentUser.displayName || 'User'}
                className="w-20 h-20 rounded-full border-4 border-white shadow-lg object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                <User className="h-10 w-10 text-white" />
              </div>
            )}

            {/* Camera overlay button */}
            <label className="absolute bottom-0 right-0 bg-white rounded-full p-2 cursor-pointer hover:bg-gray-100 transition-all duration-300 hover:scale-110 shadow-lg">
              <Camera className="h-4 w-4 text-indigo-600" />
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={isUploadingImage}
              />
            </label>

            {isUploadingImage && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold">
              {currentUser.displayName || 'Kommuter'}
            </h2>
            <p className="text-blue-100">{currentUser.email}</p>
          </div>
        </div>
      </div>

      {/* Commuter Level */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 transition-colors animate-fadeIn" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center space-x-3 mb-4">
          <Trophy className="h-6 w-6 text-yellow-500 animate-bounce" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Commuter Level
          </h3>
        </div>

        {(() => {
          const levelProgress = getLevelProgress(userPoints);
          const { currentLevel, nextLevel, progressPercentage, pointsToNext } = levelProgress;

          return (
            <div className="space-y-4">
              {/* Current Level */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl animate-bounce">{currentLevel.icon}</span>
                  <div>
                    <p className="text-xl font-bold" style={{ color: currentLevel.color }}>
                      {currentLevel.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {currentLevel.description}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white animate-pulse-slow">
                    {userPoints}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">points</p>
                </div>
              </div>

              {/* Progress Bar */}
              {nextLevel && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Progress to {nextLevel.name}
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {pointsToNext} points to go
                    </p>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${progressPercentage}%`,
                        background: `linear-gradient(to right, ${currentLevel.color}, ${nextLevel.color})`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Max Level Badge */}
              {!nextLevel && (
                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 text-center">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    🎉 You've reached the maximum level!
                  </p>
                </div>
              )}

              {/* Points Info */}
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                <p className="text-sm text-indigo-900 dark:text-indigo-100 text-center">
                  Complete trips to earn <span className="font-bold">10 points</span> each!
                </p>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Dark Mode Toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isDarkMode ? (
              <Moon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            ) : (
              <Sun className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            )}
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Dark Mode
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isDarkMode ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>

          <button
            onClick={toggleDarkMode}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              isDarkMode ? 'bg-indigo-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                isDarkMode ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Settings Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 transition-colors">
        <div className="flex items-center space-x-3 mb-4">
          <Settings className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Account Settings
          </h3>
        </div>

        <div className="space-y-4">
          {/* Email (read-only) */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {currentUser.email}
            </p>
          </div>

          {/* Display Name (editable) */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">Display Name</p>
              {!isEditingName && (
                <button
                  onClick={() => {
                    setIsEditingName(true);
                    setNewDisplayName(currentUser.displayName || '');
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {isEditingName ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Enter display name"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleUpdateDisplayName}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg flex items-center justify-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-900 dark:text-white py-2 rounded-lg flex items-center justify-center space-x-2"
                  >
                    <X className="h-4 w-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="font-medium text-gray-900 dark:text-white">
                {currentUser.displayName || 'Not set'}
              </p>
            )}
          </div>

          {/* Change Password */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">Password</p>
              {!isEditingPassword && (
                <button
                  onClick={() => setIsEditingPassword(true)}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {isEditingPassword ? (
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="New password (min 6 characters)"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="Confirm new password"
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleUpdatePassword}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg flex items-center justify-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>Update Password</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingPassword(false);
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-900 dark:text-white py-2 rounded-lg flex items-center justify-center space-x-2"
                  >
                    <X className="h-4 w-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="font-medium text-gray-900 dark:text-white">
                ••••••••
              </p>
            )}
          </div>

          {/* User ID (read-only) */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400">User ID</p>
            <p className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all">
              {currentUser.uid}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileTab;
