// contexts/CollectionContext.tsx
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { Position, CollectionContextType, CollectionState, Coordinates, CollectionMetadata } from '@/types/collection.types';
import { FeatureType } from '@/types/featureType.types';
import { PointCollected } from '@/types/pointCollected.types';
import { useLocationContext } from '@/contexts/LocationContext';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { AuthContext } from '@/contexts/AuthContext';
import { ProjectContext } from '@/contexts/ProjectContext';
import { featureStorageService } from '@/services/storage/featureStorageService';
import { syncService } from '@/services/sync/syncService';
import { getCurrentStandardizedTime } from '@/utils/datetime';
import { generateId } from '@/utils/collections';

// Extended interface to include all functionality
interface ExtendedCollectionContextType extends CollectionContextType {
  // Collection status
  isCollecting: boolean;
  currentPoints: Coordinates[];
  
  // Collection operations
  startCollection: (initialPosition: Position, featureType: FeatureType) => CollectionState;
  recordPoint: (position?: Position) => boolean;
  stopCollection: () => void;
  updateCollectionMetadata: (metadata: Partial<CollectionMetadata>) => void;
  
  // Saving operations
  isSaving: boolean;
  saveCurrentPoint: (pointData: Partial<PointCollected>, state: CollectionState) => Promise<boolean>;
  
  // Sync operations
  syncStatus: {
    isSyncing: boolean;
    lastSyncTime: Date | null;
    unsyncedCount: number;
  };
  syncPoints: () => Promise<boolean>;
  syncUnsyncedPoints: () => Promise<void>;
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
const initialState: {
  collectionState: CollectionState;
  isSaving: boolean;
  syncStatus: {
    isSyncing: boolean;
    lastSyncTime: Date | null;
    unsyncedCount: number;
  };
} = {
  collectionState: {
    points: [] as Coordinates[],
    isActive: false,
    activeFeatureType: null,
    metadata: {
      name: '',
      description: '',
      project_id: null,
      created_by: '',
      created_at: getCurrentStandardizedTime(),
      updated_at: getCurrentStandardizedTime(),
      updated_by: ''
    }
  },
  isSaving: false,
  syncStatus: {
    isSyncing: false,
    lastSyncTime: null,
    unsyncedCount: 0
  }
};

// Reducer function
function collectionReducer(
  state: typeof initialState, 
  action: CollectionAction
): typeof initialState {
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
          activeFeatureType: null,
          metadata: {
            name: '',
            description: '',
            project_id: null,
            created_by: '',
            created_at: getCurrentStandardizedTime(),
            updated_at: getCurrentStandardizedTime(),
            updated_by: ''
          }
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
  
  // Load unsynced count on startup - but only if we're logged in and have a project
  useEffect(() => {
    const loadUnsyncedCount = async () => {
      // Only proceed if we're logged in and have a project
      if (!user?.id || !activeProject?.id) {
        return;
      }

      try {
        const unsyncedPoints = await featureStorageService.getUnsyncedFeatures(activeProject.id);
        dispatch({ 
          type: 'UPDATE_UNSYNCED_COUNT', 
          payload: unsyncedPoints.length 
        });
      } catch (error) {
        console.error('Error loading unsynced points:', error);
      }
    };
    
    loadUnsyncedCount();
  }, [user?.id, activeProject?.id]); // Only run when auth or project changes

  // Helper function to get valid coordinates from position
  const getValidCoordinates = useCallback((position?: Position): Coordinates | null => {
    if (!position) {
      return currentLocation ? (Array.isArray(currentLocation) ? currentLocation : [currentLocation.longitude, currentLocation.latitude]) : null;
    }

    if (Array.isArray(position) && position.length === 2) {
      return position as Coordinates;
    }

    if ('longitude' in position && 'latitude' in position) {
      return [position.longitude, position.latitude];
    }

    return null;
  }, [currentLocation]);
  
  // Start collecting points
  const startCollection = useCallback((initialPosition: Position, featureType: FeatureType): CollectionState => {
    if (!activeProject?.id) {
      throw new Error("Cannot start collection without an active project");
    }
    
    const pointCoordinates = getValidCoordinates(initialPosition);
    if (!pointCoordinates) {
      throw new Error("Could not start collection: Invalid coordinates");
    }
    
    const newState: CollectionState = {
      points: [pointCoordinates],
      isActive: true,
      activeFeatureType: featureType,
      metadata: {
        name: '',
        description: '',
        project_id: activeProject.id,
        created_by: String(user?.id),
        created_at: getCurrentStandardizedTime(),
        updated_at: getCurrentStandardizedTime(),
        updated_by: String(user?.id)
      }
    };
    
    dispatch({ type: 'SET_COLLECTION_STATE', payload: newState });
    return newState;
  }, [getValidCoordinates, activeProject, user]);

  // Update collection metadata
  const updateCollectionMetadata = useCallback((metadata: Partial<CollectionMetadata>) => {
    if (!state.collectionState.activeFeatureType) {
      console.warn('Cannot update metadata: No active feature type');
      return;
    }

    const updatedState: CollectionState = {
      ...state.collectionState,
      activeFeatureType: state.collectionState.activeFeatureType,
      metadata: {
        ...state.collectionState.metadata,
        ...metadata,
        updated_at: getCurrentStandardizedTime(),
        updated_by: String(user?.id)
      }
    };

    dispatch({
      type: 'SET_COLLECTION_STATE',
      payload: updatedState
    });
  }, [state.collectionState, user]);

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
  
  // Save the current point with all metadata
  const saveCurrentPoint = useCallback(async (pointData: Partial<PointCollected>, state: CollectionState) => {
    if (!state.isActive || !state.points.length || !state.activeFeatureType || !state.metadata.project_id || !ggaData || !gstData) return false;

    try {
      const point: PointCollected = {
        client_id: generateId(),
        name: state.activeFeatureType.name,
        description: pointData.description || '',
        draw_layer: state.activeFeatureType.draw_layer,
        attributes: {
          ...pointData.attributes,
          nmeaData: pointData.attributes?.nmeaData || {
            gga: ggaData,
            gst: gstData
          }
        },
        created_by: state.metadata.created_by,
        created_at: state.metadata.created_at,
        updated_at: getCurrentStandardizedTime(),
        updated_by: state.metadata.updated_by,
        synced: false,
        feature_id: 0, // This is fine as it indicates unsynced state
        project_id: state.metadata.project_id
      };

      await featureStorageService.savePoint(point);
      return true;
    } catch (error) {
      console.error('Error saving point:', error);
      return false;
    }
  }, [ggaData, gstData]);
  
  // Sync points with the server
  const syncPoints = useCallback(async () => {
    if (!activeProject) return false;

    try {
      const result = await syncService.syncProject(activeProject.id);
      return result.success;
    } catch (error) {
      console.error('Error syncing points:', error);
      return false;
    }
  }, [activeProject]);

  const syncUnsyncedPoints = useCallback(async () => {
    try {
      const unsyncedFeatures = await featureStorageService.getUnsyncedFeatures(state.collectionState.metadata.project_id || 0);
      if (unsyncedFeatures.length > 0) {
        await syncService.syncProject(state.collectionState.metadata.project_id || 0);
      }
    } catch (error) {
      console.error('Error syncing unsynced points:', error);
    }
  }, [state.collectionState.metadata.project_id]);

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
        updateCollectionMetadata,
        
        // Saving operations
        isSaving: state.isSaving,
        saveCurrentPoint,
        
        // Sync operations
        syncStatus: state.syncStatus,
        syncPoints,
        syncUnsyncedPoints
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