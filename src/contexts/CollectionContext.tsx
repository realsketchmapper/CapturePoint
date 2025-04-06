// contexts/CollectionContext.tsx
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { Position, CollectionContextType, CollectionState, Coordinates, CollectionMetadata } from '@/types/collection.types';
import { FeatureType } from '@/types/featureType.types';
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
  currentPoints: Coordinates[];
  
  // Collection operations
  startCollection: (initialPosition: Position, featureType: FeatureType) => CollectionState;
  recordPoint: (position?: Position) => boolean;
  stopCollection: () => void;
  updateCollectionMetadata: (metadata: Partial<CollectionMetadata>) => void;
  
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
    activeFeatureType: null as FeatureType | null,
    metadata: {
      name: '',
      description: '',
      projectId: 0,
      created_by: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: ''
    }
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
          activeFeatureType: null,
          metadata: {
            name: '',
            description: '',
            projectId: 0,
            created_by: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
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
    const pointCoordinates = getValidCoordinates(initialPosition);
    
    if (!pointCoordinates) {
      console.warn("Could not start collection: Invalid coordinates");
      return {
        points: [],
        isActive: false,
        activeFeatureType: featureType,
        metadata: {
          name: '',
          description: '',
          projectId: activeProject?.id || 0,
          created_by: String(user?.id || 'unknown'),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          updated_by: String(user?.id || 'unknown')
        }
      };
    }
    
    const newState: CollectionState = {
      points: [pointCoordinates],
      isActive: true,
      activeFeatureType: featureType,
      metadata: {
        name: '',
        description: '',
        projectId: activeProject?.id || 0,
        created_by: String(user?.id || 'unknown'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: String(user?.id || 'unknown')
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
        updated_at: new Date().toISOString(),
        updated_by: String(user?.id || 'unknown')
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
  
  // Generate a simple ID if UUID fails as fallback
  const generateSimpleId = () => {
    return `manual-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  };
  
  // Save the current point with all metadata
  const saveCurrentPoint = useCallback(async (properties: Record<string, any> = {}, stateOverride?: CollectionState): Promise<boolean> => {
    const activeFeatureType = stateOverride?.activeFeatureType || state.collectionState.activeFeatureType;
    
    if (!activeFeatureType) {
      console.error('No active feature type');
      return false;
    }
    
    dispatch({ type: 'SET_SAVING', payload: true });
    
    const points = stateOverride?.points || state.collectionState.points;
    if (!points || points.length === 0) {
      console.error('No points to save');
      dispatch({ type: 'SET_SAVING', payload: false });
      return false;
    }
    
    try {
      const coordinates = activeFeatureType.type === 'Point' 
        ? points[0]
        : points[points.length - 1];
      
      const point: PointCollected = {
        client_id: properties.pointId || uuidv4(),
        name: properties.name || activeFeatureType.name,
        description: properties.description || '',
        feature_id: 0, // TODO: Get actual feature ID from somewhere
        created_by: String(user?.id || 'unknown'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: String(user?.id || 'unknown'),
        projectId: activeProject?.id || 0,
        nmeaData: {
          gga: ggaData || {
            time: new Date().toISOString(),
            latitude: 0,
            longitude: 0,
            quality: 0,
            satellites: 0,
            hdop: 0,
            altitude: 0,
            altitudeUnit: 'm',
            geoidHeight: 0,
            geoidHeightUnit: 'm'
          },
          gst: gstData || {
            time: new Date().toISOString(),
            rmsTotal: 0,
            semiMajor: 0,
            semiMinor: 0,
            orientation: 0,
            latitudeError: 0,
            longitudeError: 0,
            heightError: 0
          }
        },
        synced: false,
        attributes: {
          ...properties,
          featureType: activeFeatureType.type,
          featureName: activeFeatureType.name,
          coordinates,
          userId: user?.id || 'unknown',
          deviceInfo: `React Native / Expo`
        }
      };
      
      console.log('Saving point:', JSON.stringify(point, null, 2));
      await storageService.savePoint(point);
      console.log('Point saved successfully');
      
      // Update sync status to reflect new unsynced point
      // Get the current unsynced count from storage to ensure accuracy
      const unsyncedPoints = await storageService.getUnsyncedPoints();
      console.log('Current unsynced points:', unsyncedPoints.length);
      
      dispatch({ 
        type: 'SET_SYNC_STATUS', 
        payload: {
          ...state.syncStatus,
          unsyncedCount: unsyncedPoints.length
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error saving point:', error);
      return false;
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  }, [state.collectionState.activeFeatureType, state.collectionState.points, ggaData, gstData, activeProject, user, state.syncStatus]);
  
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
      
      // Update syncing state and last sync time
      dispatch({ 
        type: 'SET_SYNC_STATUS', 
        payload: {
          ...state.syncStatus,
          isSyncing: false,
          lastSyncTime: new Date()
        }
      });
      
      // Update unsynced count separately
      if (result.success) {
        // Get the current unsynced count from storage to ensure accuracy
        const unsyncedPoints = await storageService.getUnsyncedPoints();
        dispatch({ 
          type: 'UPDATE_UNSYNCED_COUNT', 
          payload: unsyncedPoints.length
        });
      }
      
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
  }, [state.syncStatus.isSyncing, state.syncStatus, activeProject]);

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