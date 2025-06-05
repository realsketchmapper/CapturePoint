// contexts/CollectionContext.tsx
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { Position, CollectionContextType, CollectionState, Coordinates, CollectionMetadata } from '@/types/collection.types';
import { FeatureType } from '@/types/featureType.types';
import { useLocationContext } from '@/contexts/LocationContext';
import { AuthContext } from '@/contexts/AuthContext';
import { ProjectContext } from '@/contexts/ProjectContext';
import { getCurrentStandardizedTime } from '@/utils/datetime';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/storage';

// Extend the CollectionContextType to include an optional position parameter in recordPoint
// and expose the entire collection state
interface ExtendedCollectionContextType extends Omit<CollectionContextType, 'recordPoint'> {
  recordPoint: (position?: Position) => boolean;
  activeFeatureType: FeatureType | null;
  metadata: CollectionMetadata;
  collectionState: CollectionState;
}

// Define action types
type CollectionAction = 
  | { type: 'SET_COLLECTION_STATE'; payload: CollectionState }
  | { type: 'ADD_POINT'; payload: Coordinates }
  | { type: 'REMOVE_LAST_POINT' }
  | { type: 'FINISH_COLLECTION' }
  | { type: 'CLEAR_COLLECTION' }
  | { type: 'UPDATE_METADATA'; payload: Partial<CollectionMetadata> };

// Define initial state
const initialState: CollectionState = {
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
};

// Reducer function
function collectionReducer(
  state: CollectionState, 
  action: CollectionAction
): CollectionState {
  switch (action.type) {
    case 'SET_COLLECTION_STATE':
      return action.payload;
    case 'UPDATE_METADATA':
      return { 
        ...state, 
        metadata: {
          ...state.metadata,
          ...action.payload,
          updated_at: getCurrentStandardizedTime()
        }
      };
    case 'ADD_POINT':
      const newPointsArray = [...state.points, action.payload];
      console.log(`✅ Added point to collection: ${newPointsArray.length} total points`, action.payload);
      return { 
        ...state, 
        points: newPointsArray
      };
    case 'REMOVE_LAST_POINT':
      if (state.points.length <= 1) {
        // Don't remove the last point
        return state;
      }
      return {
        ...state,
        points: state.points.slice(0, -1)
      };
    case 'FINISH_COLLECTION':
      return {
        ...state,
        isActive: false,
        finished: true
      };
    case 'CLEAR_COLLECTION':
      return { 
        points: [],
        isActive: false,
        finished: false,
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
      };
    default:
      return state;
  }
}

const CollectionContext = createContext<ExtendedCollectionContextType | undefined>(undefined);

export const CollectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentLocation } = useLocationContext();
  
  // Safely access auth context
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  
  // Safely access project context
  const projectContext = useContext(ProjectContext);
  const activeProject = projectContext?.activeProject;
  
  // Use reducer for state management
  const [collectionState, dispatch] = useReducer(collectionReducer, initialState);
  
  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // When app goes to background, complete any active collections
      if (nextAppState === 'background' && collectionState.isActive) {
        console.log('App going to background, stopping active collection');
        
        // For line features with enough points, we could consider saving them here
        if (collectionState.activeFeatureType?.type === 'Line' && collectionState.points.length >= 2) {
          // You could add logic here to save the line if needed
          console.log('Line collection interrupted by app background with points:', collectionState.points.length);
          // Implementation for saving the line would go here if needed
        }
        
        // Always clear the collection state when app goes to background
        dispatch({ type: 'CLEAR_COLLECTION' });
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [collectionState.isActive, collectionState.activeFeatureType, collectionState.points]);

  // On startup, check for and clear any stale collection states
  useEffect(() => {
    const checkForStaleCollections = async () => {
      try {
        // We'll use a simple timestamp approach
        const lastSessionTimestamp = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SESSION_TIMESTAMP);
        const currentTimestamp = new Date().getTime();
        
        // Update the timestamp for this session
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_SESSION_TIMESTAMP, currentTimestamp.toString());
        
        // If we have a previous timestamp and it's been more than 5 minutes (app was likely closed)
        if (lastSessionTimestamp) {
          const timeDiff = currentTimestamp - parseInt(lastSessionTimestamp);
          if (timeDiff > 5 * 60 * 1000) { // 5 minutes in milliseconds
            console.log('Detected app restart after closure, clearing any active collections');
            dispatch({ type: 'CLEAR_COLLECTION' });
          }
        }
      } catch (error) {
        console.error('Error checking for stale collections:', error);
      }
    };
    
    checkForStaleCollections();
  }, []);
  
  // Periodically update the session timestamp while app is active
  useEffect(() => {
    const updateSessionTimestamp = () => {
      AsyncStorage.setItem(STORAGE_KEYS.LAST_SESSION_TIMESTAMP, new Date().getTime().toString())
        .catch(error => console.error('Error updating session timestamp:', error));
    };
    
    const interval = setInterval(updateSessionTimestamp, 30000); // Update every 30 seconds
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  // Handle project changes
  useEffect(() => {
    if (activeProject && collectionState.isActive) {
      // If active project changes and doesn't match collection's project, stop collection
      if (activeProject.id !== collectionState.metadata.project_id && collectionState.metadata.project_id !== null) {
        console.log('Project changed, stopping active collection');
        dispatch({ type: 'CLEAR_COLLECTION' });
      }
    }
  }, [activeProject, collectionState.isActive, collectionState.metadata.project_id]);
  
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
        created_by: String(user?.id || ''),
        created_at: getCurrentStandardizedTime(),
        updated_at: getCurrentStandardizedTime(),
        updated_by: String(user?.id || '')
      }
    };
    
    dispatch({ type: 'SET_COLLECTION_STATE', payload: newState });
    return newState;
  }, [getValidCoordinates, activeProject, user]);

  // Update collection metadata
  const updateCollectionMetadata = useCallback((metadata: Partial<CollectionMetadata>) => {
    if (!collectionState.activeFeatureType) {
      console.warn('Cannot update metadata: No active feature type');
      return;
    }

    dispatch({
      type: 'UPDATE_METADATA',
      payload: {
        ...metadata,
        updated_by: String(user?.id || '')
      }
    });
  }, [collectionState.activeFeatureType, user]);

  // Record a new point
  const recordPoint = useCallback((position?: Position): boolean => {
    if (!collectionState.isActive) {
      console.log('❌ Cannot record point: Collection not active');
      return false;
    }
    
    const pointCoordinates = getValidCoordinates(position);
    
    if (!pointCoordinates) {
      console.log('❌ Cannot record point: Invalid coordinates');
      return false;
    }
    
    console.log(`📍 Recording point ${collectionState.points.length + 1}: [${pointCoordinates[0].toFixed(6)}, ${pointCoordinates[1].toFixed(6)}]`);
    dispatch({ type: 'ADD_POINT', payload: pointCoordinates });
    return true;
  }, [collectionState.isActive, getValidCoordinates, collectionState.points.length]);

  // Remove the last point
  const undoLastPoint = useCallback((): boolean => {
    if (!collectionState.isActive || collectionState.points.length <= 1) {
      return false;
    }
    
    dispatch({ type: 'REMOVE_LAST_POINT' });
    return true;
  }, [collectionState.isActive, collectionState.points.length]);

  // Stop collection
  const stopCollection = useCallback(() => {
    dispatch({ type: 'FINISH_COLLECTION' });
  }, []);

  // Add a new clearCollection function to actually clear the state
  const clearCollection = useCallback(() => {
    console.log('Reset collection state');
    dispatch({ type: 'CLEAR_COLLECTION' });
  }, []);

  // Reset collection state
  const resetCollectionState = useCallback(() => {
    console.log('Reset collection state');
    dispatch({ type: 'CLEAR_COLLECTION' });
  }, []);

  return (
    <CollectionContext.Provider
      value={{
        isCollecting: collectionState.isActive,
        currentPoints: collectionState.points,
        activeFeatureType: collectionState.activeFeatureType,
        metadata: collectionState.metadata,
        collectionState,
        startCollection,
        recordPoint,
        undoLastPoint,
        stopCollection,
        clearCollection,
        updateCollectionMetadata,
        resetCollectionState
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