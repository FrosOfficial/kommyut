// my-app/src/components/ui/Indicators.tsx

import React from 'react';
import { Users } from 'lucide-react';
import type { TrafficIndicatorProps, CrowdLevelProps } from '../../types';
import { theme } from '../../theme';

export const TrafficIndicator: React.FC<TrafficIndicatorProps> = ({ level }) => {
  const colors = ['bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];
  return (
    <div className="flex space-x-1">
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${
            i <= level ? colors[i] : 'bg-gray-300'
          }`}
        />
      ))}
    </div>
  );
};

export const CrowdLevel: React.FC<CrowdLevelProps> = ({ level }) => {
  const maxIcons = 5;
  const safeLevel = Math.max(0, Math.min(level, maxIcons));
  const icons = Array(maxIcons).fill(0);
  
  return (
    <div className="flex space-x-0.5">
      {icons.map((_, i) => (
        <Users
          key={i}
          className={`h-3 w-3`}
          style={{ color: i < safeLevel ? theme.primary : '#D1D5DB' }}
        />
      ))}
    </div>
  );
};