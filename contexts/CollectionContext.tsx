// contexts/CollectionContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Position, CollectionContextType, CollectionState } from '@/types/collection.types';
import { Feature } from '@/types/features.types';
import { PointCollected } from '@/types/pointCollected.types';
import { useLocationContext } from '@/contexts/LocationContext';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { AuthContext } from '@/contexts/AuthContext';
import { ProjectContext } from '@/contexts/ProjectContext';
import { storageService } from '@/services/storage/storageService';
import { syncService } from '@/services/sync/syncService';
// Replace v4 import with a more React Native friendly approach
import 'react-native-get-random-values'; // Add this import at the top
import { v4 as uuidv4 } from 'uuid';

// Extended interface to include all functionality
interface ExtendedCollectionContextType extends CollectionContextType {
  // Collection status
  isCollecting: boolean;
  currentPoints: [number, number][];
  
  // Collection operations
  startCollection: (initialPosition: Position, feature: Feature) => CollectionState;
  recordPoint: (position?: Position) => boolean;
  stopCollection: () => void;
  
  // Saving operations
  isSaving: boolean;
  saveCurrentPoint: (properties?: Record<string, any>, state?: CollectionState) => Promise<boolean>;
  
  // Sync operations
  syncStatus: {
    isSyncing: boolean;
    lastSyncTime: Date | null;
    unsyncedCount: number;
  };
  syncPoints: () => Promise<boolean>;
}

const CollectionContext = createContext<ExtendedCollectionContextType | undefined>(undefined);

export const CollectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentLocation } = useLocationContext();
  const { ggaData, gstData } = useNMEAContext();
  
  // Safely access auth context
  const authContext = useContext(AuthContext);
  const authInitialized = authContext !== undefined;
  const user = authInitialized ? authContext.user : null;
  
  // Safely access project context
  const projectContext = useContext(ProjectContext);
  const projectInitialized = projectContext !== undefined;
  const activeProject = projectInitialized ? projectContext.activeProject : null;
  
  // Collection state
  const [collectionState, setCollectionState] = useState<CollectionState>({
    points: [],
    isActive: false,
    activeFeature: null
  });
  
  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  
  // Sync state
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    lastSyncTime: null as Date | null,
    unsyncedCount: 0
  });
  
  // Load unsynced count on startup
  useEffect(() => {
    const loadUnsyncedCount = async () => {
      const unsyncedPoints = await storageService.getUnsyncedPoints();
      setSyncStatus(prev => ({
        ...prev,
        unsyncedCount: unsyncedPoints.length
      }));
    };
    
    loadUnsyncedCount();
  }, []);

  // Helper function to get valid coordinates from position
  const getValidCoordinates = useCallback((position?: Position): [number, number] | null => {
    if (!position) {
      return currentLocation;
    }

    if (Array.isArray(position)) {
      return position;
    }

    if (position.longitude && position.latitude) {
      return [position.longitude, position.latitude];
    }

    return currentLocation;
  }, [currentLocation]);
  
  // Start collecting points
  const startCollection = useCallback((initialPosition: Position, feature: Feature): CollectionState => {
    const pointCoordinates = getValidCoordinates(initialPosition);
    
    if (!pointCoordinates) {
      console.warn("Could not start collection: Invalid coordinates");
      return {
        points: [],
        isActive: false,
        activeFeature: null
      };
    }
    
    const newState = {
      points: [pointCoordinates],
      isActive: true,
      activeFeature: feature
    };
    
    setCollectionState(newState);
    return newState;
  }, [getValidCoordinates]);

  // Record a new point
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
    
    return true;
  }, [collectionState.isActive, getValidCoordinates]);

  // Stop collection
  const stopCollection = useCallback(() => {
    setCollectionState({
      points: [],
      isActive: false,
      activeFeature: null
    });
  }, []);
  
  // Generate a simple ID if UUID fails as fallback
  const generateSimpleId = () => {
    return `manual-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  };
  
  // Save the current point with all metadata
  const saveCurrentPoint = useCallback(async (properties: Record<string, any> = {}, state?: CollectionState): Promise<boolean> => {
    const activeFeature = state?.activeFeature || collectionState.activeFeature;
    const points = state?.points || collectionState.points;

    if (!activeFeature || points.length === 0
      || !ggaData?.latitude || !ggaData?.longitude || !gstData?.rmsTotal) {
      console.warn('Missing required data to save point:', {
        hasFeature: !!activeFeature,
        pointsLength: points.length,
        hasGGA: !!ggaData?.latitude && !!ggaData?.longitude,
        hasGST: !!gstData?.rmsTotal
      });
      return false;
    }

    // Require pointId to be provided
    if (!properties.pointId) {
      console.error('No pointId provided to saveCurrentPoint');
      return false;
    }
    
    setIsSaving(true);
    
    try {
      const coordinates = activeFeature.type === 'Point' 
        ? points[0]
        : points[points.length - 1];
      
      const point: PointCollected = {
        id: properties.pointId,
        name: properties.name || activeFeature.name,
        featureType: activeFeature.type,
        created_at: new Date().toISOString(),
        projectId: activeProject?.id || 0,
        featureTypeId: activeFeature.id,
        coordinates,
        nmeaData: {
          gga: ggaData,
          gst: gstData
        },
        synced: false,
        properties: {
          ...properties,
          featureType: activeFeature.type,
          featureName: activeFeature.name,
          userId: user?.id || 'unknown',
          deviceInfo: `React Native / Expo`
        }
      };
      
      await storageService.savePoint(point);
      
      setSyncStatus(prev => ({
        ...prev,
        unsyncedCount: prev.unsyncedCount + 1
      }));
      
      return true;
    } catch (error) {
      console.error('Error saving point:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [collectionState.activeFeature, collectionState.points, ggaData, gstData, activeProject, user]);
  
  // Sync points with the server
  const syncPoints = useCallback(async (): Promise<boolean> => {
    if (syncStatus.isSyncing) {
      return false; // Already syncing
    }
    
    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    
    try {
      let result;
      
      if (activeProject) {
        // If we have an active project, sync points for that project
        result = await syncService.syncPoints(activeProject.id);
      } else {
        // If no active project, sync all points across all projects
        result = await syncService.syncAllPoints();
      }
      
      setSyncStatus({
        isSyncing: false,
        lastSyncTime: new Date(),
        unsyncedCount: result.success 
          ? Math.max(0, syncStatus.unsyncedCount - result.syncedCount)
          : syncStatus.unsyncedCount
      });
      
      return result.success;
    } catch (error) {
      console.error('Error syncing points:', error);
      
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false
      }));
      
      return false;
    }
  }, [syncStatus.isSyncing, syncStatus.unsyncedCount, activeProject]);

  return (
    <CollectionContext.Provider
      value={{
        // Collection status
        isCollecting: collectionState.isActive,
        currentPoints: collectionState.points,
        
        // Collection operations
        startCollection,
        recordPoint,
        stopCollection,
        
        // Saving operations
        isSaving,
        saveCurrentPoint,
        
        // Sync operations
        syncStatus,
        syncPoints
      }}
    >
      {children}
    </CollectionContext.Provider>
  );
};

export const useCollectionContext = () => {
  const context = useContext(CollectionContext);
  if (context === undefined) {
    throw new Error('useCollectionContext must be used within a CollectionProvider');
  }
  return context;
};