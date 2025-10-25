import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Settings, Camera, Edit2, Moon, Sun, Save, X, Lock, Trophy, Wallet, Shield, Calendar, Upload, FileText, XCircle } from 'lucide-react';
import { updateProfile, updatePassword } from 'firebase/auth';
import { auth } from '../../config/firebase';
import * as api from '../../services/api';
import { getCommuterLevel, getLevelProgress } from '../../utils/commuterLevel';
import { getUserTypeLabel, getFarePrice } from '../../utils/fareCalculation';
import LoginPrompt from '../common/LoginPrompt';
import type { UserType } from '../../types';

const ProfileTab: React.FC = () => {
  const { currentUser } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isEditingBirthday, setIsEditingBirthday] = useState(false);
  const [isEditingUserType, setIsEditingUserType] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(currentUser?.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState(currentUser?.photoURL || '');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingId, setIsUploadingId] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [userPoints, setUserPoints] = useState(0);
  const [userBirthday, setUserBirthday] = useState('');
  const [newBirthday, setNewBirthday] = useState('');
  const [userTypeState, setUserTypeState] = useState<UserType>(currentUser?.userType || 'regular');
  const [newUserType, setNewUserType] = useState<UserType>('regular');
  const [idDocumentUrl, setIdDocumentUrl] = useState('');
  const [verificationNote, setVerificationNote] = useState('');
  const [idVerified, setIdVerified] = useState(currentUser?.idVerified || false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFileName, setSelectedFileName] = useState('');

  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser) return;

      try {
        const userData = await api.getUserByUid(currentUser.uid);
        setUserPoints(userData.points || 0);

        // Load profile picture from database if available
        if (userData.photo_url) {
          setProfileImageUrl(userData.photo_url);
        }

        // Load birthday
        if (userData.birthday) {
          setUserBirthday(userData.birthday);
        }

        // Load user type
        if (userData.user_type) {
          setUserTypeState(userData.user_type as UserType);
        }

        // Load ID document URL
        if (userData.id_document_url) {
          setIdDocumentUrl(userData.id_document_url);
        }

        // Load verification status and note
        setIdVerified(userData.id_verified || false);
        setVerificationNote(userData.verification_note || '');
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
    if (!currentUser || !newDisplayName.trim() || !auth.currentUser) return;

    try {
      await updateProfile(auth.currentUser, {
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
    if (!currentUser || !auth.currentUser) return;

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
      await updatePassword(auth.currentUser, newPassword);
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

    // Check file size (max 500KB for base64 storage)
    if (file.size > 500 * 1024) {
      setErrorMessage('Image must be less than 500KB');
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
          // Update user in database with the base64 image
          await api.createOrUpdateUser({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: base64String
          });

          setProfileImageUrl(base64String);
          setSuccessMessage('Profile picture updated successfully!');
          setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error: any) {
          console.error('Error uploading profile picture:', error);
          setErrorMessage(error.message || 'Failed to update profile picture');
          setTimeout(() => setErrorMessage(''), 3000);
        } finally {
          setIsUploadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error reading image file:', error);
      setErrorMessage('Failed to read image file');
      setTimeout(() => setErrorMessage(''), 3000);
      setIsUploadingImage(false);
    }
  };

  const handleUpdateBirthday = async () => {
    if (!currentUser || !newBirthday) return;

    try {
      await api.createOrUpdateUser({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        birthday: newBirthday
      });

      setUserBirthday(newBirthday);
      setSuccessMessage('Birthday updated successfully!');
      setIsEditingBirthday(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update birthday');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleUpdateUserType = async () => {
    if (!currentUser) return;

    try {
      await api.createOrUpdateUser({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        userType: newUserType,
        idVerified: false // Reset verification when changing user type
      });

      setUserTypeState(newUserType);
      setSuccessMessage('User type updated! Please upload your ID for verification.');
      setIsEditingUserType(false);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update user type');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    // Reset states before new upload
    setUploadProgress(0);
    setSelectedFileName('');

    // Set selected file name
    setSelectedFileName(file.name);

    // Check file size (max 1MB for ID documents)
    if (file.size > 1024 * 1024) {
      setErrorMessage('ID document must be less than 1MB');
      setTimeout(() => setErrorMessage(''), 3000);
      setSelectedFileName('');
      e.target.value = '';
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setErrorMessage('ID document must be an image');
      setTimeout(() => setErrorMessage(''), 3000);
      setSelectedFileName('');
      e.target.value = '';
      return;
    }

    setIsUploadingId(true);

    try {
      // Simulate upload progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // Convert image to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;

        try {
          setUploadProgress(95);

          // Update user in database with the ID document
          // Set idVerified to false when uploading new ID
          await api.createOrUpdateUser({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            userType: userTypeState, // Preserve current user type
            idDocumentUrl: base64String,
            idVerified: false // Reset verification status - needs admin approval
          });

          setUploadProgress(100);
          setIdDocumentUrl(base64String);
          setIdVerified(false);
          setVerificationNote('');

          // Reload user data to refresh verification status
          const userData = await api.getUserByUid(currentUser.uid);
          if (userData.user_type) {
            setUserTypeState(userData.user_type as UserType);
          }

          setSuccessMessage('✓ ID document uploaded successfully! Pending admin verification.');

          // Clear success message and file name after delay
          setTimeout(() => {
            setSuccessMessage('');
          }, 5000);

          // Clear file name after a shorter delay (after upload animation completes)
          setTimeout(() => {
            setSelectedFileName('');
          }, 2000);
        } catch (error: any) {
          console.error('Error uploading ID document:', error);
          setErrorMessage(error.message || 'Failed to upload ID document');
          setTimeout(() => {
            setErrorMessage('');
            setSelectedFileName('');
          }, 3000);
        } finally {
          clearInterval(progressInterval);
          setIsUploadingId(false);
          setTimeout(() => setUploadProgress(0), 1000);
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error reading ID document:', error);
      setErrorMessage('Failed to read ID document');
      setTimeout(() => {
        setErrorMessage('');
        setSelectedFileName('');
      }, 3000);
      setIsUploadingId(false);
      setUploadProgress(0);
    }

    // Reset file input
    e.target.value = '';
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

      {/* ID Verification Rejected Banner - Show prominently if ID was rejected (even if user type was reset to regular) */}
      {!idVerified && verificationNote && verificationNote.toLowerCase() !== 'id verified' && verificationNote.trim() !== '' && idDocumentUrl && (
        <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-2 border-red-300 dark:border-red-700 rounded-2xl p-6 animate-fadeIn shadow-lg">
          <div className="flex items-start space-x-4">
            <div className="bg-red-500 rounded-full p-3">
              <XCircle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="text-lg font-bold text-red-900 dark:text-red-100">
                  ID Verification Rejected
                </h3>
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  Action Required
                </span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                <span className="font-semibold">Reason:</span> {verificationNote}
              </p>
              <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200">
                  Your account was reset to Regular user. Please select your user type below and upload a new valid ID document to reapply for verification and receive fare discounts.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Verification Banner - Show if user type is not regular, ID uploaded, but not yet verified and no rejection */}
      {userTypeState !== 'regular' && !idVerified && idDocumentUrl && (!verificationNote || verificationNote === 'ID verified' || verificationNote === '') && (
        <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-2xl p-6 animate-fadeIn shadow-lg">
          <div className="flex items-start space-x-4">
            <div className="bg-yellow-500 rounded-full p-3">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-100">
                  {getUserTypeLabel(userTypeState)} Discount Pending
                </h3>
                <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                  Pending Verification
                </span>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                Your ID is being verified. You'll receive full discount benefits once approved.
              </p>
              <div className="flex items-center space-x-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2 opacity-60">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Current Fare</p>
                  <p className="text-xl font-bold text-gray-600 dark:text-gray-400">
                    ₱13
                  </p>
                </div>
                <div className="text-gray-400">→</div>
                <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">After Verification</p>
                  <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                    ₱{getFarePrice(userTypeState)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fare Discount Card - Show if user has discount AND ID is verified */}
      {userTypeState !== 'regular' && idVerified && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-300 dark:border-green-700 rounded-2xl p-6 animate-fadeIn shadow-lg">
          <div className="flex items-start space-x-4">
            <div className="bg-green-500 rounded-full p-3">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="text-lg font-bold text-green-900 dark:text-green-100">
                  {getUserTypeLabel(userTypeState)} Discount Active
                </h3>
                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                  <Shield className="h-3 w-3" />
                  <span>Verified</span>
                </span>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                You're eligible for discounted fares on all jeepney rides!
              </p>
              <div className="flex items-center space-x-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Your Fare</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    ₱{getFarePrice(userTypeState)}
                  </p>
                </div>
                <div className="text-gray-400">vs</div>
                <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2 opacity-60">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Regular Fare</p>
                  <p className="text-xl font-bold text-gray-600 dark:text-gray-400 line-through">
                    ₱13
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

          {/* Birthday (editable) */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Birthday</p>
              </div>
              {!isEditingBirthday && (
                <button
                  onClick={() => {
                    setIsEditingBirthday(true);
                    setNewBirthday(userBirthday);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {isEditingBirthday ? (
              <div className="space-y-2">
                <input
                  type="date"
                  value={newBirthday}
                  onChange={(e) => setNewBirthday(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleUpdateBirthday}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg flex items-center justify-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => setIsEditingBirthday(false)}
                    className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-900 dark:text-white py-2 rounded-lg flex items-center justify-center space-x-2"
                  >
                    <X className="h-4 w-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="font-medium text-gray-900 dark:text-white">
                {userBirthday ? new Date(userBirthday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}
              </p>
            )}
          </div>

          {/* User Type (editable) */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">User Type</p>
              </div>
              {!isEditingUserType && (
                <button
                  onClick={() => {
                    setIsEditingUserType(true);
                    setNewUserType(userTypeState);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {isEditingUserType ? (
              <div className="space-y-3">
                <select
                  value={newUserType}
                  onChange={(e) => setNewUserType(e.target.value as UserType)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="regular">Regular</option>
                  <option value="student">Student</option>
                  <option value="senior">Senior Citizen</option>
                  <option value="pwd">Person with Disability (PWD)</option>
                </select>

                {/* ID Verification section inside User Type editing */}
                <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start space-x-2 mb-2">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <h5 className="text-sm font-bold text-gray-900 dark:text-white mb-1">ID Verification</h5>
                      {newUserType === 'regular' ? (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                          Select Student, Senior Citizen, or PWD above to upload your ID for fare discount verification.
                        </p>
                      ) : (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                          Upload a valid ID to verify your {getUserTypeLabel(newUserType)} status and receive fare discounts.
                        </p>
                      )}

                      {/* Only show upload buttons if non-regular type is selected */}
                      {newUserType !== 'regular' && (
                        <>
                          {idDocumentUrl ? (
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2 text-xs text-gray-700 dark:text-gray-300">
                                <Shield className="h-3 w-3" />
                                <span>ID Document Uploaded</span>
                                {idVerified ? (
                                  <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center space-x-1">
                                    <Shield className="h-2 w-2" />
                                    <span>Verified</span>
                                  </span>
                                ) : verificationNote && verificationNote.toLowerCase() !== 'id verified' && verificationNote.trim() !== '' ? (
                                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">Rejected</span>
                                ) : (
                                  <span className="bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">Pending Review</span>
                                )}
                              </div>

                              <label className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg cursor-pointer transition-all text-xs">
                                <Upload className="h-3 w-3" />
                                <span>Upload New ID</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleIdUpload}
                                  className="hidden"
                                  disabled={isUploadingId}
                                />
                              </label>
                            </div>
                          ) : (
                            <label className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg cursor-pointer transition-all text-xs">
                              <Upload className="h-3 w-3" />
                              <span>Upload ID Document</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleIdUpload}
                                className="hidden"
                                disabled={isUploadingId}
                              />
                            </label>
                          )}

                          {/* Upload progress */}
                          {isUploadingId && (
                            <div className="mt-2 space-y-1 animate-fadeIn">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center space-x-1 text-indigo-600 dark:text-indigo-400">
                                  <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                  <span className="font-medium">Uploading...</span>
                                </div>
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{uploadProgress}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-indigo-500 to-blue-600 rounded-full transition-all duration-300"
                                  style={{ width: `${uploadProgress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Success indicator */}
                          {uploadProgress === 100 && isUploadingId && (
                            <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg animate-fadeIn">
                              <div className="flex items-center space-x-2 text-green-700 dark:text-green-300 text-xs">
                                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                  <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                                  </svg>
                                </div>
                                <span className="font-medium">Upload complete!</span>
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Accepted: Student ID, Senior Citizen ID, PWD ID (Max: 1MB)
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={handleUpdateUserType}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg flex items-center justify-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingUserType(false);
                      setNewUserType(userTypeState);
                    }}
                    className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-900 dark:text-white py-2 rounded-lg flex items-center justify-center space-x-2"
                  >
                    <X className="h-4 w-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900 dark:text-white">
                  {getUserTypeLabel(userTypeState)}
                </p>
                {userTypeState !== 'regular' && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    currentUser.idVerified
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  }`}>
                    {currentUser.idVerified ? 'Verified' : 'Pending Verification'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ID Verification (show if user type is not regular AND not editing) */}
          {userTypeState !== 'regular' && !isEditingUserType && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
              <div className="flex items-start space-x-3 mb-3">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-1" />
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-1">ID Verification</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                    Upload a valid ID to verify your {getUserTypeLabel(userTypeState)} status and receive fare discounts.
                  </p>

                  {/* Always show upload buttons in this section (we know userTypeState !== 'regular') */}
                  <>
                      {idDocumentUrl ? (
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                            <Shield className="h-4 w-4" />
                            <span>ID Document Uploaded</span>
                            {idVerified ? (
                              <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1 animate-pulse">
                                <Shield className="h-3 w-3" />
                                <span>Verified</span>
                              </span>
                            ) : verificationNote && verificationNote !== 'ID verified' && verificationNote !== '' ? (
                              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">Rejected</span>
                            ) : (
                              <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">Pending Review</span>
                            )}
                          </div>

                          <label className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg cursor-pointer transition-all hover:scale-105 active:scale-95">
                            <Upload className="h-4 w-4" />
                            <span>Upload New ID</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleIdUpload}
                              className="hidden"
                              disabled={isUploadingId}
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg cursor-pointer transition-all hover:scale-105 active:scale-95">
                          <Upload className="h-4 w-4" />
                          <span>Upload ID Document</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleIdUpload}
                            className="hidden"
                            disabled={isUploadingId}
                          />
                        </label>
                      )}
                    </>

                  {/* Selected file name - only show after successful upload and before clearing */}
                  {selectedFileName && !isUploadingId && uploadProgress === 0 && (
                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg animate-fadeIn">
                      <p className="text-xs text-green-700 dark:text-green-300 flex items-center space-x-2">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span className="truncate font-medium">Last uploaded: {selectedFileName}</span>
                      </p>
                    </div>
                  )}

                  {/* Upload progress */}
                  {isUploadingId && (
                    <div className="mt-3 space-y-2 animate-fadeIn">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
                          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          <span className="font-medium">Uploading ID document...</span>
                        </div>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">{uploadProgress}%</span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>

                      {selectedFileName && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center space-x-1">
                          <FileText className="h-3 w-3" />
                          <span className="truncate">{selectedFileName}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Success indicator */}
                  {uploadProgress === 100 && isUploadingId && (
                    <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg animate-fadeIn">
                      <div className="flex items-center space-x-2 text-green-700 dark:text-green-300">
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                          </svg>
                        </div>
                        <span className="text-sm font-medium">Upload complete!</span>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Accepted: Student ID, Senior Citizen ID, PWD ID. Max file size: 1MB
                  </p>
                </div>
              </div>
            </div>
          )}

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
