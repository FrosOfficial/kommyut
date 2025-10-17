// my-app/src/App.tsx

import React from 'react';
import Header from './components/layout/Header';
import BottomNav from './components/layout/BottomNav';
import RoutesTab from './components/tabs/RoutesTab';
import { AuthProvider } from './context/AuthContext';
import SavedTab from './components/tabs/SavedTab';
import ActivityTab from './components/tabs/ActivityTab';
import ProfileTab from './components/tabs/ProfileTab';
import { useKommyut } from './hooks/useKommyut';


const KommyutApp: React.FC = () => {
  const {
    isOfflineMode,
    activeTab,
    isSearching,
    showNotifications,
    setShowNotifications,
    userPoints,
    handleTabChange,
  } = useKommyut();

  // Initialize dark mode from localStorage on app load
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // State for pre-filling route search from saved routes
  const [routeSearchFrom, setRouteSearchFrom] = React.useState<string>('');
  const [routeSearchTo, setRouteSearchTo] = React.useState<string>('');

  // Handle when user clicks play on a saved route
  const handleSavedRouteSelect = (from: string, to: string) => {
    setRouteSearchFrom(from);
    setRouteSearchTo(to);
    handleTabChange('routes'); // Switch to routes tab
  };

  // Keep all tabs mounted to preserve state
  const renderTabs = () => (
    <>
      <div style={{ display: activeTab === 'routes' ? 'block' : 'none' }}>
        <RoutesTab initialFrom={routeSearchFrom} initialTo={routeSearchTo} />
      </div>
      <div style={{ display: activeTab === 'saved' ? 'block' : 'none' }}>
        <SavedTab onRouteSelect={handleSavedRouteSelect} />
      </div>
      <div style={{ display: activeTab === 'activity' ? 'block' : 'none' }}>
        <ActivityTab />
      </div>
      <div style={{ display: activeTab === 'profile' ? 'block' : 'none' }}>
        <ProfileTab userPoints={userPoints} />
      </div>
    </>
  );

return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Header
      isOfflineMode={isOfflineMode}
      showNotifications={showNotifications}
      setShowNotifications={setShowNotifications}
    />

    <main className="pb-20">
      <div className="p-4">
        {renderTabs()}
      </div>
    </main>

    {/* Loading Overlay */}
    {isSearching && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 mx-4 text-center shadow-2xl">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">Finding Best Routes</h3>
          <p className="text-gray-600">Analyzing real-time traffic and transit data...</p>
          <div className="mt-4 flex justify-center space-x-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
        </div>
      </div>
    )}

    <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      </div>
    </AuthProvider>
);
};

export default KommyutApp;