// Commuter level system based on user points
export interface CommuterLevel {
  name: string;
  minPoints: number;
  maxPoints: number;
  color: string;
  icon: string;
  description: string;
}

export const COMMUTER_LEVELS: CommuterLevel[] = [
  {
    name: 'Bronze',
    minPoints: 0,
    maxPoints: 499,
    color: '#CD7F32', // Bronze color
    icon: '🥉',
    description: 'Getting started with public transport'
  },
  {
    name: 'Silver',
    minPoints: 500,
    maxPoints: 1249,
    color: '#C0C0C0', // Silver color
    icon: '🥈',
    description: 'Regular commuter'
  },
  {
    name: 'Gold',
    minPoints: 1250,
    maxPoints: 2499,
    color: '#FFD700', // Gold color
    icon: '🥇',
    description: 'Experienced traveler'
  },
  {
    name: 'Platinum',
    minPoints: 2500,
    maxPoints: Infinity,
    color: '#E5E4E2', // Platinum color
    icon: '💎',
    description: 'Public transport expert'
  }
];

/**
 * Calculate commuter level based on user points
 * @param points - User's current points
 * @returns The commuter level object
 */
export const getCommuterLevel = (points: number): CommuterLevel => {
  // Ensure points is not negative
  const validPoints = Math.max(0, points);
  
  // Find the appropriate level
  const level = COMMUTER_LEVELS.find(level => 
    validPoints >= level.minPoints && validPoints <= level.maxPoints
  );
  
  // Return Bronze as default if no level found (shouldn't happen)
  return level || COMMUTER_LEVELS[0];
};

/**
 * Calculate progress to next level
 * @param points - User's current points
 * @returns Object with current level, next level, and progress percentage
 */
export const getLevelProgress = (points: number) => {
  const currentLevel = getCommuterLevel(points);
  const currentLevelIndex = COMMUTER_LEVELS.findIndex(level => level.name === currentLevel.name);
  
  // If already at highest level
  if (currentLevelIndex === COMMUTER_LEVELS.length - 1) {
    return {
      currentLevel,
      nextLevel: null,
      progressPercentage: 100,
      pointsToNext: 0
    };
  }
  
  const nextLevel = COMMUTER_LEVELS[currentLevelIndex + 1];
  const pointsInCurrentLevel = points - currentLevel.minPoints;
  const totalPointsNeeded = nextLevel.minPoints - currentLevel.minPoints;
  const progressPercentage = Math.min(100, (pointsInCurrentLevel / totalPointsNeeded) * 100);
  const pointsToNext = Math.max(0, nextLevel.minPoints - points);
  
  return {
    currentLevel,
    nextLevel,
    progressPercentage,
    pointsToNext
  };
};
