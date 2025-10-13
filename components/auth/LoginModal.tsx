// src/components/auth/LoginModal.tsx

import React, { useState } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider } from '../../config/firebase';
import { createOrUpdateUser, getUserByUid } from '../../services/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
  };
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, theme }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailPasswordDisabled, setEmailPasswordDisabled] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Clear any existing messages
    setShowError(false);
    setShowSuccess(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    console.log('🚀 Attempting authentication...');

    try {
      // Validate form data
      if (!formData.email || !formData.password) {
        throw new Error('Please fill in all required fields');
      }

      if (!isLogin) {
        // Sign up validation
        if (!formData.name) {
          throw new Error('Please enter your full name');
        }
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (formData.password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }

        // Create account
        console.log('📧 Creating account with email:', formData.email);
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          formData.email, 
          formData.password
        );
        console.log('✅ Account created successfully!', userCredential.user);
        
        // Update user profile with display name
        if (userCredential.user) {
          await createOrUpdateUser({
            uid: userCredential.user.uid,
            email: userCredential.user.email,
            displayName: formData.name,
            photoURL: userCredential.user.photoURL,
          });
        }

        setSuccessMessage('Account successfully created!');
        setShowSuccess(true);
        
        // Auto-hide success message and switch to login after 2 seconds
        setTimeout(() => {
          setShowSuccess(false);
          setIsLogin(true);
          setFormData({ name: '', email: '', password: '', confirmPassword: '' });
        }, 2000);

      } else {
        // Sign in
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        onClose();
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      let errorMsg = 'An error occurred. Please try again.';
      
      if (error.code === 'auth/operation-not-allowed') {
        errorMsg = 'Email/password authentication is not enabled. Please use Google sign-in for now.';
        setEmailPasswordDisabled(true);
      } else if (error.code === 'auth/email-already-in-use') {
        errorMsg = 'This email is already registered. Please sign in instead.';
      } else if (error.code === 'auth/weak-password') {
        errorMsg = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'Please enter a valid email address.';
      } else if (error.code === 'auth/user-not-found') {
        errorMsg = 'No account found with this email. Please sign up first.';
      } else if (error.code === 'auth/wrong-password') {
        errorMsg = 'Incorrect password. Please try again.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setErrorMessage(errorMsg);
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

const handleGoogleSignIn = async () => {
    try {
      setErrorMessage(null);
      setShowError(false);
      
      // Debug: Log current domain
      console.log('Current domain:', window.location.hostname);
      console.log('Current origin:', window.location.origin);
      
      const result = await signInWithPopup(auth, googleProvider);
      
      // If sign in was successful, close the modal immediately
      if (result.user) {
        // Close modal first for better UX
        onClose();
        
        // Note: User creation/update is now handled by AuthContext
        // No need to duplicate the logic here
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      setErrorMessage('Failed to sign in with Google. Please try again.');
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Decorative Background */}
        <div 
          className="absolute top-0 left-0 right-0 h-40 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryLight} 100%)`
          }}
        >
          <div className="absolute top-0 right-0 w-56 h-56 bg-white opacity-10 rounded-full -mr-20 -mt-20 animate-pulse duration-3000" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-10 rounded-full -ml-16 -mb-16 animate-pulse duration-4000" />
          <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-white opacity-5 rounded-full transform rotate-45 animate-pulse duration-2500" />
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 active:bg-white/40 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <X className="h-5 w-5 text-white" />
        </button>

        {/* Content */}
        <div className="relative pt-20 pb-8 px-8">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl ring-4 ring-white/50 animate-in zoom-in duration-300">
              <User className="h-8 w-8" style={{ color: theme.primary }} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isLogin ? 'Welcome Back!' : 'Create Account'}
            </h2>
            <p className="text-gray-600 text-sm">
              {isLogin ? 'Sign in to continue your journey' : 'Join Kommyut today'}
            </p>
          </div>

          {/* Error Message */}
          {showError && errorMessage && (
            <div className="animate-in slide-in-from-top-2 fade-in duration-200 absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
              <div className="flex items-center space-x-2 bg-red-50 border border-red-200 px-4 py-2 rounded-lg shadow-lg">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-red-600 text-sm font-medium">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {showSuccess && successMessage && (
            <div className="animate-in slide-in-from-top-2 fade-in duration-200 absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
              <div className="flex items-center space-x-2 bg-green-50 border border-green-200 px-4 py-2 rounded-lg shadow-lg">
                <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-green-600 text-sm font-medium">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Email/Password Disabled Notice */}
          {emailPasswordDisabled && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-yellow-800 font-medium text-sm">Email/Password Authentication Disabled</p>
                  <p className="text-yellow-700 text-xs mt-1">Please use Google sign-in below to create your account.</p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <div className={`space-y-4 ${emailPasswordDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent shadow-sm hover:border-gray-400 focus:ring-blue-500/20 transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all"
                  />
                </div>
              </div>
            )}

            {isLogin && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center">
                  <input type="checkbox" className="mr-2 rounded" />
                  <span className="text-gray-600">Remember me</span>
                </label>
                <button
                  type="button"
                  className="font-medium hover:underline"
                  style={{ color: theme.primary }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isLoading || emailPasswordDisabled}
              className={`w-full text-white font-semibold py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] shadow-md ${
                isLoading || emailPasswordDisabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{ backgroundColor: theme.primary }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{isLogin ? 'Signing in...' : 'Creating account...'}</span>
                </div>
              ) : emailPasswordDisabled ? (
                'Use Google Sign-in Below'
              ) : (
                isLogin ? 'Login' : 'Create Account'
              )}
            </button>

            {/* Alternative sign-in suggestion */}
            {!isLogin && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-700 text-sm text-center">
                  <strong>Tip:</strong> For the best experience, use Google sign-in below
                </p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">or continue with</span>
            </div>
          </div>

          {/* Social Login */}
          <div className="w-full">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className={`w-full flex items-center justify-center space-x-2 py-3 border-2 rounded-xl transition-all duration-200 shadow-sm ${
                emailPasswordDisabled 
                  ? 'border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 shadow-md' 
                  : 'border-gray-300 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100'
              }`}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className={`text-sm font-medium ${emailPasswordDisabled ? 'text-blue-700' : 'text-gray-700'}`}>
                {emailPasswordDisabled ? 'Sign up with Google' : 'Continue with Google'}
              </span>
            </button>
          </div>

          {/* Toggle Login/Signup */}
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              {' '}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="font-semibold hover:underline"
                style={{ color: theme.primary }}
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;