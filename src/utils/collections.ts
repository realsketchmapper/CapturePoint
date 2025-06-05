import { Position } from "@/types/collection.types";

export const isValidPosition = (position: Position): position is { longitude: number; latitude: number } => {
  // Check if it's the object format
  if (typeof position === 'object' && !Array.isArray(position)) {
    return typeof position.longitude === 'number' && 
           typeof position.latitude === 'number' &&
           !isNaN(position.longitude) && 
           !isNaN(position.latitude);
  }
  return false;
};

export const generateId = (): string => {
  const random = Math.random().toString(36).slice(2, 11);
  const timestamp = Date.now().toString(36);
  return `${random}-${timestamp}`;
};

/**
 * Calculate distance between two coordinates using the Haversine formula
 * @param coord1 - First coordinate [longitude, latitude]
 * @param coord2 - Second coordinate [longitude, latitude]
 * @returns Distance in meters
 */
export function calculateDistance(coord1: [number, number], coord2: [number, number]): number {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance;
}

/**
 * Calculate the total distance of a line by summing distances between consecutive points
 * @param coordinates - Array of coordinates [[longitude, latitude], ...]
 * @returns Total distance in meters
 */
export function calculateLineDistance(coordinates: [number, number][]): number {
  if (coordinates.length < 2) {
    return 0;
  }
  
  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    totalDistance += calculateDistance(coordinates[i - 1], coordinates[i]);
  }
  
  return totalDistance;
}

/**
 * Format distance for display
 * @param distanceInMeters - Distance in meters
 * @returns Formatted distance string with appropriate units
 */
export function formatDistance(distanceInMeters: number): string {
  if (distanceInMeters < 1000) {
    return `${distanceInMeters.toFixed(1)} m`;
  } else {
    return `${(distanceInMeters / 1000).toFixed(2)} km`;
  }
}