// my-app/src/components/tabs/SavedTab.tsx

import React from 'react';
import { MapPin, ChevronRight, Building, Heart, Award } from 'lucide-react';
import { theme } from '../../theme';

interface SavedRoute {
  id: number;
  name: string;
  from: string;
  to: string;
  icon: React.ComponentType<any>;
  used: number;
}

interface SavedTabProps {
  savedRoutes?: SavedRoute[];
}

const SavedTab: React.FC<SavedTabProps> = ({ savedRoutes }) => {
  const mockSavedRoutes = [
    { id: 1, name: 'Home to Work', from: 'BGC, Taguig', to: 'Makati CBD', icon: Building, used: 45 },
    { id: 2, name: 'Weekend Shopping', from: 'Home', to: 'SM Megamall', icon: Heart, used: 12 },
    { id: 3, name: 'School Route', from: 'Quezon City', to: 'UP Diliman', icon: Award, used: 23 }
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <h3 className="text-lg font-semibold mb-4">Saved Routes</h3>
        <div className="space-y-3">
          {mockSavedRoutes.map(route => (
            <div key={route.id} className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: `${theme.primary}10` }}>
                    <route.icon className="h-6 w-6" style={{ color: theme.primary }} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{route.name}</p>
                    <p className="text-sm text-gray-600">{route.from} → {route.to}</p>
                    <p className="text-xs text-gray-500 mt-1">Used {route.used} times</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-5">
        <h3 className="text-lg font-semibold mb-4">Favorite Stops</h3>
        <div className="grid grid-cols-2 gap-3">
          {['Ayala MRT', 'BGC Bus Terminal', 'Cubao Terminal', 'EDSA Shaw'].map((stop, i) => (
            <button key={i} className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all text-left">
              <MapPin className="h-5 w-5 mb-2" style={{ color: theme.primary }} />
              <p className="text-sm font-medium text-gray-900">{stop}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SavedTab;