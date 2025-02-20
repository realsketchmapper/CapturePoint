import React, { createContext, useContext, useState, useCallback } from 'react';
import { Position, CollectionContextType, CollectionState } from '@/types/collection.types';
import { isValidPosition } from '@/utils/collections';
import { Feature } from '@/types/features.types';
import { useFeature } from '@/hooks/useFeature';

const CollectionContext = createContext<CollectionContextType | undefined>(undefined);

export const CollectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  
  const { selectedFeature } = useFeature();
  
  const [collectionState, setCollectionState] = useState<CollectionState>({
    points: [],
    isActive: false,
    activeFeature: null
  });

  const startCollection = useCallback((initialPosition: Position, feature: Feature): boolean => {
    if (!isValidPosition(initialPosition)) {
      return false;
    }

    const validPoint: [number, number] = [initialPosition.longitude, initialPosition.latitude];
    setCollectionState({
      points: [validPoint],
      isActive: true,
      activeFeature: selectedFeature
    });
    
    return true;
  }, []);

  const recordPoint = useCallback((position: Position): boolean => {
    if (!collectionState.isActive || !isValidPosition(position)) {
      return false;
    }

    const validPoint: [number, number] = [position.longitude, position.latitude];
    setCollectionState(prev => ({
      ...prev,
      points: [...prev.points, validPoint]
    }));

    return true;
  }, [collectionState.isActive]);

  const stopCollection = useCallback(() => {
    setCollectionState({
      points: [],
      isActive: false,
      activeFeature: null
    });
  }, []);

  const getCurrentCollection = useCallback(() => ({
    points: collectionState.points,
    isActive: collectionState.isActive
  }), [collectionState]);

  return (
    <CollectionContext.Provider
      value={{
        isCollecting: collectionState.isActive,
        currentPoints: collectionState.points,
        startCollection,
        stopCollection,
        recordPoint,
        getCurrentCollection
      }}
    >
      {children}
    </CollectionContext.Provider>
  );
};

export const useCollection = () => {
  const context = useContext(CollectionContext);
  if (context === undefined) {
    throw new Error('useCollection must be used within a CollectionProvider');
  }
  return context;
};