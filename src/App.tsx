// my-app/src/App.tsx

import React from 'react';
import Header from './components/layout/Header';           
import BottomNav from './components/layout/BottomNav';     
import RoutesTab from './components/tabs/RoutesTab';
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
    savedRoutes,
    userPoints,
    currentTrip,
    handleTabChange,
  } = useKommyut();

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'routes':
        return <RoutesTab />;
      case 'saved':
        return <SavedTab savedRoutes={savedRoutes} />;
      case 'activity':
        return <ActivityTab currentTrip={currentTrip} />;
      case 'profile':
        return <ProfileTab userPoints={userPoints} />;
      default:
        return null;
    }
  };

return (
  <div className="min-h-screen bg-gray-50">
    <Header
      isOfflineMode={isOfflineMode}
      showNotifications={showNotifications}
      setShowNotifications={setShowNotifications}
    />

    <main className="pb-20">
      <div className="p-4">
        {renderActiveTab()}
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
);
};

export default KommyutApp;