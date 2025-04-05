// contexts/CollectionContext.tsx
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { Position, CollectionContextType, CollectionState, Coordinates } from '@/src/types/collection.types';
import { FeatureType } from '@/src/types/featureType.types';
import { PointCollected } from '@/src/types/pointCollected.types';
import { useLocationContext } from '@/src/contexts/LocationContext';
import { useNMEAContext } from '@/src/contexts/NMEAContext';
import { AuthContext } from '@/src/contexts/AuthContext';
import { ProjectContext } from '@/src/contexts/ProjectContext';
import { storageService } from '@/services/storage/storageService';
import { syncService } from '@/services/sync/syncService';
// Replace v4 import with a more React Native friendly approach
import 'react-native-get-random-values'; // Add this import at the top
import { v4 as uuidv4 } from 'uuid';

// Extended interface to include all functionality
interface ExtendedCollectionContextType extends CollectionContextType {
  // Collection status
  isCollecting: boolean;
  currentPoints: Coordinates[];
  
  // Collection operations
  startCollection: (initialPosition: Position, featureType: FeatureType) => CollectionState;
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

// Define action types
type CollectionAction = 
  | { type: 'SET_COLLECTION_STATE'; payload: CollectionState }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_SYNC_STATUS'; payload: { isSyncing: boolean; lastSyncTime: Date | null; unsyncedCount: number } }
  | { type: 'UPDATE_UNSYNCED_COUNT'; payload: number }
  | { type: 'ADD_POINT'; payload: Coordinates }
  | { type: 'CLEAR_COLLECTION' };

// Define initial state
const initialState = {
  collectionState: {
    points: [] as Coordinates[],
    isActive: false,
    activeFeatureType: null as FeatureType | null
  },
  isSaving: false,
  syncStatus: {
    isSyncing: false,
    lastSyncTime: null as Date | null,
    unsyncedCount: 0
  }
};

// Reducer function
function collectionReducer(state: typeof initialState, action: CollectionAction): typeof initialState {
  switch (action.type) {
    case 'SET_COLLECTION_STATE':
      return { 
        ...state, 
        collectionState: action.payload 
      };
    case 'SET_SAVING':
      return { 
        ...state, 
        isSaving: action.payload 
      };
    case 'SET_SYNC_STATUS':
      return { 
        ...state, 
        syncStatus: action.payload 
      };
    case 'UPDATE_UNSYNCED_COUNT':
      return { 
        ...state, 
        syncStatus: {
          ...state.syncStatus,
          unsyncedCount: action.payload
        }
      };
    case 'ADD_POINT':
      return { 
        ...state, 
        collectionState: {
          ...state.collectionState,
          points: [...state.collectionState.points, action.payload]
        }
      };
    case 'CLEAR_COLLECTION':
      return { 
        ...state, 
        collectionState: {
          points: [],
          isActive: false,
          activeFeatureType: null
        }
      };
    default:
      return state;
  }
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
  
  // Use reducer for state management
  const [state, dispatch] = useReducer(collectionReducer, initialState);
  
  // Load unsynced count on startup
  useEffect(() => {
    const loadUnsyncedCount = async () => {
      try {
        const unsyncedPoints = await storageService.getUnsyncedPoints();
        dispatch({ 
          type: 'UPDATE_UNSYNCED_COUNT', 
          payload: unsyncedPoints.length 
        });
      } catch (error) {
        console.error('Error loading unsynced points:', error);
      }
    };
    
    loadUnsyncedCount();
  }, []);

  // Helper function to get valid coordinates from position
  const getValidCoordinates = useCallback((position?: Position): Position | null => {
    if (!position) {
      return currentLocation;
    }

    if (Array.isArray(position) && position.length === 2) {
      return position as Position;
    }

    if (position.longitude && position.latitude) {
      return [position.longitude, position.latitude];
    }

    return currentLocation;
  }, [currentLocation]);
  
  // Start collecting points
  const startCollection = useCallback((initialPosition: Position, featureType: FeatureType): CollectionState => {
    const pointCoordinates = getValidCoordinates(initialPosition);
    
    if (!pointCoordinates) {
      console.warn("Could not start collection: Invalid coordinates");
      return {
        points: [],
        isActive: false,
        activeFeatureType: null
      };
    }
    
    const newState = {
      points: [pointCoordinates],
      isActive: true,
      activeFeatureType: featureType
    };
    
    dispatch({ type: 'SET_COLLECTION_STATE', payload: newState });
    return newState;
  }, [getValidCoordinates]);

  // Record a new point
  const recordPoint = useCallback((position?: Position): boolean => {
    if (!state.collectionState.isActive) {
      return false;
    }
    
    const pointCoordinates = getValidCoordinates(position);
    
    if (!pointCoordinates) {
      return false;
    }
    
    dispatch({ type: 'ADD_POINT', payload: pointCoordinates });
    return true;
  }, [state.collectionState.isActive, getValidCoordinates]);

  // Stop collection
  const stopCollection = useCallback(() => {
    dispatch({ type: 'CLEAR_COLLECTION' });
  }, []);
  
  // Generate a simple ID if UUID fails as fallback
  const generateSimpleId = () => {
    return `manual-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  };
  
  // Save the current point with all metadata
  const saveCurrentPoint = useCallback(async (properties: Record<string, any> = {}, stateOverride?: CollectionState): Promise<boolean> => {
    const activeFeature = stateOverride?.activeFeature || state.collectionState.activeFeature;
    const points = stateOverride?.points || state.collectionState.points;

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
    
    dispatch({ type: 'SET_SAVING', payload: true });
    
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
      
      dispatch({ 
        type: 'UPDATE_UNSYNCED_COUNT', 
        payload: state.syncStatus.unsyncedCount + 1 
      });
      
      return true;
    } catch (error) {
      console.error('Error saving point:', error);
      return false;
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  }, [state.collectionState.activeFeature, state.collectionState.points, ggaData, gstData, activeProject, user, state.syncStatus.unsyncedCount]);
  
  // Sync points with the server
  const syncPoints = useCallback(async (): Promise<boolean> => {
    if (state.syncStatus.isSyncing) {
      return false; // Already syncing
    }
    
    dispatch({ 
      type: 'SET_SYNC_STATUS', 
      payload: { 
        ...state.syncStatus, 
        isSyncing: true 
      } 
    });
    
    try {
      let result;
      
      if (activeProject) {
        // If we have an active project, sync points for that project
        result = await syncService.syncPoints(activeProject.id);
      } else {
        // If no active project, sync all points across all projects
        result = await syncService.syncAllPoints();
      }
      
      dispatch({ 
        type: 'SET_SYNC_STATUS', 
        payload: {
          isSyncing: false,
          lastSyncTime: new Date(),
          unsyncedCount: result.success 
            ? Math.max(0, state.syncStatus.unsyncedCount - result.syncedCount)
            : state.syncStatus.unsyncedCount
        }
      });
      
      return result.success;
    } catch (error) {
      console.error('Error syncing points:', error);
      
      dispatch({ 
        type: 'SET_SYNC_STATUS', 
        payload: { 
          ...state.syncStatus, 
          isSyncing: false 
        } 
      });
      
      return false;
    }
  }, [state.syncStatus.isSyncing, state.syncStatus.unsyncedCount, activeProject]);

  return (
    <CollectionContext.Provider
      value={{
        // Collection status
        isCollecting: state.collectionState.isActive,
        currentPoints: state.collectionState.points,
        
        // Collection operations
        startCollection,
        recordPoint,
        stopCollection,
        
        // Saving operations
        isSaving: state.isSaving,
        saveCurrentPoint,
        
        // Sync operations
        syncStatus: state.syncStatus,
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