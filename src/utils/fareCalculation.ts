import type { UserType } from '../types';

/**
 * Get fare ID based on user type
 * F001 - Regular fare (₱13)
 * F002 - Discounted fare (₱11) for students, PWD, and seniors
 */
export const getFareId = (userType: UserType): string => {
  return userType === 'regular' ? 'F001' : 'F002';
};

/**
 * Get fare price based on user type
 */
export const getFarePrice = (userType: UserType): number => {
  return userType === 'regular' ? 13 : 11;
};

/**
 * Check if user is eligible for discounted fare
 */
export const isDiscountEligible = (userType: UserType): boolean => {
  return userType !== 'regular';
};

/**
 * Calculate fare based on user type and distance
 * This is for PUJ (public utility jeepney) fares
 */
export const calculatePujFare = (
  userType: UserType,
  distance: number // in kilometers
): number => {
  const baseFare = getFarePrice(userType);

  // Base fare covers first 4km
  if (distance <= 4) {
    return baseFare;
  }

  // Additional ₱1.50 per km after 4km (same for both regular and discounted)
  const additionalDistance = distance - 4;
  const additionalFare = Math.ceil(additionalDistance) * 1.5;

  return baseFare + additionalFare;
};

/**
 * Get fare discount percentage
 */
export const getDiscountPercentage = (userType: UserType): number => {
  if (userType === 'regular') return 0;

  // Calculate discount: (13 - 11) / 13 * 100 = ~15.38%
  const regularFare = 13;
  const discountedFare = 11;
  return Math.round(((regularFare - discountedFare) / regularFare) * 100);
};

/**
 * Format fare display with currency
 */
export const formatFare = (fare: number): string => {
  return `₱${fare.toFixed(2)}`;
};

/**
 * Get user type display label
 */
export const getUserTypeLabel = (userType: UserType): string => {
  switch (userType) {
    case 'regular':
      return 'Regular';
    case 'student':
      return 'Student';
    case 'pwd':
      return 'PWD';
    case 'senior':
      return 'Senior Citizen';
    default:
      return 'Regular';
  }
};
