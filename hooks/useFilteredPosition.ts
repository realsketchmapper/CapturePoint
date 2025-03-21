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

export const useFilteredPosition = (minDistanceThreshold = 0): [number, number] | null => {
  const { currentLocation } = useLocationContext();
  
  // Simply return the current location without filtering
  return currentLocation;
};