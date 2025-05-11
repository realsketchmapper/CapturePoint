import { useState, useCallback } from 'react';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { useFeatureStorage } from '@/hooks/useFeatureStorage';
import { useFeatureSync } from '@/hooks/useFeatureSync';
import { PointCollected } from '@/types/pointCollected.types';
import { Position } from '@/types/collection.types';
import { FeatureType } from '@/types/featureType.types';

/**
 * Hook that combines collection state, storage, and sync operations
 * Provides a unified interface for components to interact with collections
 */
export const useCollectionManager = () => {
  // Get collection state and functions
  const { 
    isCollecting, 
    currentPoints,
    activeFeatureType,
    metadata,
    collectionState,
    startCollection,
    recordPoint,
    stopCollection,
    updateCollectionMetadata
  } = useCollectionContext();

  // Get storage functions
  const { 
    isSaving, 
    error: storageError, 
    savePoint 
  } = useFeatureStorage();

  // Get sync functions
  const projectId = metadata.project_id;
  const { 
    isSyncing, 
    lastSyncTime, 
    unsyncedCount, 
    error: syncError, 
    syncFeatures, 
    syncUnsyncedFeatures 
  } = useFeatureSync(projectId);

  /**
   * Start a new collection and save the initial point
   */
  const startAndSaveCollection = useCallback(async (
    initialPosition: Position, 
    featureType: FeatureType,
    pointData?: Partial<PointCollected>
  ) => {
    const newCollectionState = startCollection(initialPosition, featureType);
    
    if (pointData) {
      await savePoint(pointData, newCollectionState);
    }
    
    return newCollectionState;
  }, [startCollection, savePoint]);

  /**
   * Record a new point in the collection and save it
   */
  const recordAndSavePoint = useCallback(async (
    position?: Position,
    pointData?: Partial<PointCollected>
  ): Promise<boolean> => {
    if (!isCollecting || !activeFeatureType) {
      return false;
    }

    const pointRecorded = recordPoint(position);
    
    if (pointRecorded && pointData) {
      await savePoint(pointData, collectionState);
      return true;
    }
    
    return pointRecorded;
  }, [recordPoint, isCollecting, activeFeatureType, collectionState, savePoint]);

  /**
   * Stop the current collection and attempt to sync
   */
  const stopAndSyncCollection = useCallback(async (): Promise<void> => {
    stopCollection();
    await syncUnsyncedFeatures();
  }, [stopCollection, syncUnsyncedFeatures]);

  return {
    // Collection state
    isCollecting,
    currentPoints,
    activeFeatureType,
    metadata,
    collectionState,
    
    // Basic collection operations
    startCollection,
    recordPoint,
    stopCollection,
    updateCollectionMetadata,
    
    // Storage operations
    isSaving,
    storageError,
    savePoint,
    
    // Sync operations
    isSyncing,
    lastSyncTime,
    unsyncedCount,
    syncError,
    syncFeatures,
    syncUnsyncedFeatures,
    
    // Combined operations
    startAndSaveCollection,
    recordAndSavePoint,
    stopAndSyncCollection
  };
}; 