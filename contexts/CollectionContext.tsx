import React, { createContext, useContext, useState, useCallback } from 'react';
import { Position, CollectionContextType, CollectionState } from '@/types/collection.types';
import { Feature } from '@/types/features.types';
import { useLocationContext } from '@/contexts/LocationContext';
import { useCameraContext } from './CameraContext';

const CollectionContext = createContext<CollectionContextType | undefined>(undefined);

export const CollectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentLocation } = useLocationContext();
  const { setCamera } = useCameraContext();
  const [collectionState, setCollectionState] = useState<CollectionState>({
    points: [],
    isActive: false,
    activeFeature: null
  });

  // Helper function to get valid coordinates from a position
  const getValidCoordinates = useCallback((position?: Position): [number, number] | null => {
    if (position?.longitude && position?.latitude) {
      return [position.longitude, position.latitude];
    }
    return currentLocation;
  }, [currentLocation]);
  
  // Start collection with position (using current location if provided position is invalid)
  const startCollection = useCallback((initialPosition: Position, feature: Feature): boolean => {
    const pointCoordinates = getValidCoordinates(initialPosition);
    
    if (!pointCoordinates) {
      console.log("coords are invalid");
      return false;
    }
    
    setCollectionState({
      points: [pointCoordinates],
      isActive: true,
      activeFeature: feature
    });
    
    return true;
  }, [getValidCoordinates]);

  // Record a point using provided position or current location
  const recordPoint = useCallback((position?: Position): boolean => {
    if (!collectionState.isActive) {
      return false;
    }
    
    const pointCoordinates = getValidCoordinates(position);
    
    if (!pointCoordinates) {
      return false;
    }
    
    setCollectionState(prev => ({
      ...prev,
      points: [...prev.points, pointCoordinates]
    }));
    
    // Set camera to current location when a point is recorded
    if (currentLocation) {
      setCamera({
        centerCoordinate: currentLocation,
        animationDuration: 500
      });
    }
    
    return true;
  }, [collectionState.isActive, currentLocation, getValidCoordinates, setCamera]);

  const stopCollection = useCallback(() => {
    setCollectionState({
      points: [],
      isActive: false,
      activeFeature: null
    });
  }, []);

  return (
    <CollectionContext.Provider
      value={{
        isCollecting: collectionState.isActive,
        currentPoints: collectionState.points,
        startCollection,
        stopCollection,
        recordPoint
      }}
    >
      {children}
    </CollectionContext.Provider>
  );
};

export const useCollectionContext = () => {
  const context = useContext(CollectionContext);
  if (context === undefined) {
    throw new Error('useCollection must be used within a CollectionProvider');
  }
  return context;
};