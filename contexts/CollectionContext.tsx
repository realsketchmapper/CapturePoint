// contexts/CollectionContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Position, CollectionContextType, CollectionState } from '@/types/collection.types';
import { CollectedFeature, FeatureToRender, FeatureType } from '@/types/features.types';
import { PointCollected } from '@/types/pointCollected.types';
import { useLocationContext } from '@/contexts/LocationContext';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { AuthContext } from '@/contexts/AuthContext';
import { ProjectContext } from '@/contexts/ProjectContext';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { storageService } from '@/services/storage/storageService';
import { syncService } from '@/services/sync/syncService';
import { generateClientId } from '@/utils/collections';
// Replace v4 import with a more React Native friendly approach
import 'react-native-get-random-values'; // Add this import at the top


// Extended interface to include all functionality
interface ExtendedCollectionContextType extends CollectionContextType {
  // Collection status
  isCollecting: boolean;
  currentPoints: [number, number][];
  
  // Collection operations
  startCollection: (initialPosition: Position, feature: FeatureType) => Promise<CollectionState>;
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
  loadUnsyncedCount: () => Promise<void>;
}

const CollectionContext = createContext<ExtendedCollectionContextType | undefined>(undefined);

export const CollectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentLocation } = useLocationContext();
  const { ggaData, gstData } = useNMEAContext();
  const { clearFeatures, renderFeature } = useMapContext();
  
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
  
  // Remove the useEffect and make loading explicit
  const loadUnsyncedCount = useCallback(async () => {
    if (!user?.id) {
      console.log('No authenticated user, skipping unsynced count check');
      return;
    }
    
    const unsyncedPoints = await storageService.getUnsyncedPoints();
    setSyncStatus(prev => ({
      ...prev,
      unsyncedCount: unsyncedPoints.length
    }));
  }, [user?.id]);

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
  const startCollection = useCallback(async (initialPosition: Position, feature: FeatureType): Promise<CollectionState> => {
    if (!activeProject) {
      console.error('No active project');
      return collectionState;
    }

    // Validate coordinates
    const validCoords = getValidCoordinates(initialPosition);
    if (!validCoords) {
      console.error('No valid position available');
      return collectionState;
    }

    // Set the active feature type
    const newState: CollectionState = {
      points: [validCoords],
      isActive: true,
      activeFeature: feature
    };

    setCollectionState(newState);

    // For point features, we need to render immediately
    if (feature.geometryType === 'Point') {
      const client_id = generateClientId();  // Generate client_id first
      const featureToRender: FeatureToRender = {
        type: feature.geometryType,
        coordinates: validCoords,
        properties: {
          client_id,  // Use the same client_id
          name: feature.name,
          category: feature.category,
          style: feature.attributes?.style,
          featureType: feature  // Add the feature type to properties
        }
      };
      renderFeature(featureToRender);

      // Save the point immediately
      const point: PointCollected = {
        client_id,  // Use the same client_id
        feature_name: feature.name,  // Add feature_name property
        fcode: 'PT',
        coordinates: validCoords,
        attributes: {
          nmeaData: ggaData && gstData ? {
            gga: ggaData,
            gst: gstData
          } : undefined,
          name: feature.name,
          category: feature.draw_layer,
          type: feature.geometryType,
          featureTypeName: feature.name,
          featureTypeId: feature.id
        },
        project_id: activeProject.id,  // Keep as number
        feature_id: client_id,  // Use client_id as feature_id since it's a string
        is_active: true,
        is_synced: false,  // Initialize as unsynced
        created_by: user?.id || null,
        created_at: new Date().toISOString(),
        updated_by: user?.id || null,
        updated_at: new Date().toISOString()
      };

      // Save the point
      await storageService.savePoint(point);
    }

    return newState;
  }, [activeProject, getValidCoordinates, renderFeature, currentLocation, ggaData, gstData, user]);

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

    if (!activeFeature || !activeProject) {
      console.error('No active feature or project');
      return false;
    }

    try {
      // Create the point with feature type information
      const point: PointCollected = {
        feature_name: activeFeature.name,
        client_id: generateClientId(),
        fcode: 'PT',
        coordinates: collectionState.points[0],
        attributes: {
          type: activeFeature.geometryType,
          featureTypeName: activeFeature.name,
          featureTypeId: activeFeature.id,
          category: activeFeature.category,
          name: activeFeature.name,
          style: activeFeature.attributes?.style || {},
          ...properties
        },
        project_id: activeProject.id,
        feature_id: generateClientId(),
        is_active: true,
        is_synced: false,
        created_by: 1, // TODO: Get from auth context
        created_at: new Date().toISOString(),
        updated_by: 1, // TODO: Get from auth context
        updated_at: new Date().toISOString()
      };

      // Save the point
      await storageService.savePoint(point);
      console.log('Point added locally with ID:', point.client_id, 'for project:', activeProject.id);

      // Stop collection
      stopCollection();

      // Sync with server
      const result = await syncService.syncPoints(activeProject.id);
      
      // After successful sync, refresh the map
      if (result.success && activeProject) {
        console.log('Sync successful, updating map...');
        const features = await storageService.getProjectFeatures(activeProject.id);
        console.log(`Loaded ${features.length} features from storage after sync`);
        
        // Get the list of synced feature IDs
        const syncedFeatureIds = result.syncedIds || [];
        console.log('Synced feature IDs:', syncedFeatureIds);
        
        // Render each feature on the map
        for (const feature of features) {
          if (!feature.points || feature.points.length === 0) {
            console.log(`Skipping feature ${feature.client_id} - no points`);
            continue;
          }

          // For point features, we need to render each point individually
          if (feature.points[0].attributes?.type === 'Point') {
            // Get the feature type from storage using the name
            const featureType = await storageService.getFeatureTypeByName(
              feature.points[0].attributes?.featureTypeName,
              activeProject.id
            );

            if (!featureType) {
              console.warn(`Feature type ${feature.points[0].attributes?.featureTypeName} not found for point ${feature.points[0].client_id}`);
              continue;
            }

            feature.points.forEach(point => {
              // Only update if this point was synced
              if (syncedFeatureIds.includes(point.client_id)) {
                console.log(`Updating synced point: ${point.client_id}`);
                const featureToRender: FeatureToRender = {
                  type: point.attributes?.type || 'Point',
                  coordinates: point.coordinates,
                  properties: {
                    client_id: point.client_id,
                    name: point.attributes?.name || feature.name,
                    category: point.attributes?.category || feature.attributes?.category,
                    style: point.attributes?.style || {},
                    featureType // Add the feature type to properties
                  }
                };
                renderFeature(featureToRender);
              }
            });
          }
        }
      }
      
      return result.success;
    } catch (error) {
      console.error('Error syncing points:', error);
      
      // On error, verify the actual unsynced count
      const unsyncedPoints = await storageService.getUnsyncedPoints();
      
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        unsyncedCount: unsyncedPoints.length
      }));
      
      return false;
    }
  }, [syncStatus.isSyncing, activeProject, clearFeatures, renderFeature]);
  
  // Sync points with the server
  const syncPoints = useCallback(async (): Promise<boolean> => {
    if (syncStatus.isSyncing) {
      return false; // Already syncing
    }
    
    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    
    try {
      let result;
      
      // Get unsynced points to determine which project to sync
      const unsyncedPoints = await storageService.getUnsyncedPoints();
      if (unsyncedPoints.length === 0) {
        console.log('No unsynced points to sync');
        setSyncStatus(prev => ({ ...prev, isSyncing: false }));
        return true;
      }

      // Use the project ID from the first unsynced point
      const projectId = unsyncedPoints[0].project_id;
      console.log('Syncing points for project:', projectId);
      
      result = await syncService.syncPoints(projectId);

      // Update sync status based on the actual remaining unsynced count
      const remainingUnsynced = await storageService.getUnsyncedPoints();
      const unsyncedCount = remainingUnsynced.length;
      console.log('Setting unsynced count to:', unsyncedCount);
      
      setSyncStatus({
        isSyncing: false,
        lastSyncTime: new Date(),
        unsyncedCount: unsyncedCount
      });

      // After successful sync, refresh the map
      if (result.success && activeProject) {
        console.log('Sync successful, updating map...');
        const features = await storageService.getProjectFeatures(activeProject.id);
        console.log(`Loaded ${features.length} features from storage after sync`);
        
        // Get the list of synced feature IDs
        const syncedFeatureIds = result.syncedIds || [];
        console.log('Synced feature IDs:', syncedFeatureIds);
        
        // Render each feature on the map
        for (const feature of features) {
          if (!feature.points || feature.points.length === 0) {
            console.log(`Skipping feature ${feature.client_id} - no points`);
            continue;
          }

          // For point features, we need to render each point individually
          if (feature.points[0].attributes?.type === 'Point') {
            // Get the feature type from storage using the name
            const featureType = await storageService.getFeatureTypeByName(
              feature.points[0].attributes?.featureTypeName,
              activeProject.id
            );

            if (!featureType) {
              console.warn(`Feature type ${feature.points[0].attributes?.featureTypeName} not found for point ${feature.points[0].client_id}`);
              continue;
            }

            feature.points.forEach(point => {
              // Only update if this point was synced
              if (syncedFeatureIds.includes(point.client_id)) {
                console.log(`Updating synced point: ${point.client_id}`);
                const featureToRender: FeatureToRender = {
                  type: point.attributes?.type || 'Point',
                  coordinates: point.coordinates,
                  properties: {
                    client_id: point.client_id,
                    name: point.attributes?.name || feature.name,
                    category: point.attributes?.category || feature.attributes?.category,
                    style: point.attributes?.style || {},
                    featureType // Add the feature type to properties
                  }
                };
                renderFeature(featureToRender);
              }
            });
          }
        }
      }
      
      return result.success;
    } catch (error) {
      console.error('Error syncing points:', error);
      
      // On error, verify the actual unsynced count
      const unsyncedPoints = await storageService.getUnsyncedPoints();
      
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        unsyncedCount: unsyncedPoints.length
      }));
      
      return false;
    }
  }, [syncStatus.isSyncing, activeProject, clearFeatures, renderFeature]);

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
        syncPoints,
        loadUnsyncedCount
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