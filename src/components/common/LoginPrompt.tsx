import React from 'react';
import { LogIn, Sparkles } from 'lucide-react';

interface LoginPromptProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  gradientFrom: string;
  gradientTo: string;
  onLoginClick?: () => void;
}

const LoginPrompt: React.FC<LoginPromptProps> = ({
  icon: Icon,
  title,
  description,
  gradientFrom,
  gradientTo,
  onLoginClick
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header with Gradient */}
      <div className={`bg-gradient-to-r ${gradientFrom} ${gradientTo} rounded-2xl p-6 text-white shadow-xl`}>
        <div className="flex items-center space-x-3 mb-2">
          <Icon className="h-8 w-8 animate-bounce" />
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
        <p className="text-white/90">{description}</p>
      </div>

      {/* Animated Login Card */}
      <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-12 text-center transition-all duration-300 hover:shadow-2xl group">
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Floating Particles Animation */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-indigo-400 rounded-full animate-float opacity-40" style={{ animationDelay: '0s' }} />
          <div className="absolute top-1/2 right-1/4 w-3 h-3 bg-purple-400 rounded-full animate-float opacity-30" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-pink-400 rounded-full animate-float opacity-40" style={{ animationDelay: '2s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10">
          {/* Login Icon with Pulse */}
          <div className="inline-flex items-center justify-center w-20 h-20 mb-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow-lg animate-pulse-slow">
            <LogIn className="h-10 w-10 text-white" />
          </div>

          {/* Message */}
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500 animate-spin-slow" />
            Welcome to Kommyut!
            <Sparkles className="h-5 w-5 text-yellow-500 animate-spin-slow" />
          </h3>

          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Sign in to unlock personalized features, save your favorite routes, track your journeys, and level up as a commuter!
          </p>

          {/* Login Button */}
          <button
            onClick={onLoginClick}
            className="group/btn relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden"
          >
            {/* Button Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />

            <LogIn className="h-5 w-5 relative z-10 group-hover/btn:rotate-12 transition-transform duration-300" />
            <span className="relative z-10">Sign In to Continue</span>
          </button>

          {/* Benefits List */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
              <span>Save Routes</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
              <span>Track Trips</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
              <span>Level Up</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPrompt;
