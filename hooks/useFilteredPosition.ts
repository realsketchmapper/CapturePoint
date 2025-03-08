// 1. useFilteredPosition.ts (keep as is)
import { useState, useEffect, useRef } from 'react';
import { useLocationContext } from '@/contexts/LocationContext';

// Minimum distance in meters to trigger a position update
const DEFAULT_MIN_DISTANCE = 5;

// Simple distance calculation between two points
const getSimpleDistance = (
  lon1: number, 
  lat1: number, 
  lon2: number, 
  lat2: number
): number => {
  // Convert to approximate meters (very rough approximation)
  const latDistance = Math.abs(lat2 - lat1) * 111000;
  const lonDistance = Math.abs(lon2 - lon1) * 111000 * Math.cos(lat1 * Math.PI / 180);
  
  // Pythagorean distance
  return Math.sqrt(latDistance * latDistance + lonDistance * lonDistance);
};

export const useFilteredPosition = (minDistanceThreshold = DEFAULT_MIN_DISTANCE): [number, number] | null => {
  const { currentLocation } = useLocationContext();
  const [filteredPosition, setFilteredPosition] = useState<[number, number] | null>(null);
  const lastPositionRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!currentLocation) return;
    
    if (!lastPositionRef.current) {
      setFilteredPosition(currentLocation);
      lastPositionRef.current = currentLocation;
      return;
    }
    
    const distance = getSimpleDistance(
      lastPositionRef.current[0], 
      lastPositionRef.current[1],
      currentLocation[0], 
      currentLocation[1]
    );
    
    if (distance > minDistanceThreshold) {
      setFilteredPosition(currentLocation);
      lastPositionRef.current = currentLocation;
    }
  }, [currentLocation, minDistanceThreshold]);

  return filteredPosition;
};