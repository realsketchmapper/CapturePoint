// contexts/CollectionContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Position, CollectionContextType, CollectionState } from '@/types/collection.types';
import { CollectedFeature, FeatureToRender } from '@/types/features.types';
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
import { v4 as uuidv4 } from 'uuid';

// Extended interface to include all functionality
interface ExtendedCollectionContextType extends CollectionContextType {
  // Collection status
  isCollecting: boolean;
  currentPoints: [number, number][];
  
  // Collection operations
  startCollection: (initialPosition: Position, feature: CollectedFeature) => CollectionState;
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
  const startCollection = useCallback((initialPosition: Position, feature: CollectedFeature): CollectionState => {
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

    console.log('\n=== Saving Point ===');
  

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
      
      console.log('Creating point with coordinates:', coordinates);
      
      const point: PointCollected = {
        id: null, // Mark as unsynced - will be set by server
        client_id: generateClientId(),
        fcode: 'PT', // Default feature code for points
        coordinates,
        attributes: {
          nmeaData: {
            gga: ggaData,
            gst: gstData
          },
          name: properties.name || activeFeature.name,
          category: activeFeature.draw_layer,  // Required for collected_features table
          type: activeFeature.type,           // Required for collected_features table
          featureType: activeFeature.type,    // Keep for backwards compatibility
          style: properties.style,
          featureTypeId: activeFeature.id     // Add the feature type ID
        },
        project_id: activeProject?.id || 0,
        feature_id: activeFeature.id,
        is_active: true,
        created_by: user?.id || null,
        created_at: new Date().toISOString(),
        updated_by: user?.id || null,
        updated_at: new Date().toISOString()
      };
      
      console.log('Saving point to storage:', point);
      await storageService.savePoint(point);
      
      // Verify point was saved
      const projectPoints = await storageService.getProjectPoints(point.project_id);
      console.log(`After save: ${projectPoints.length} points in project storage`);
      const savedPoint = projectPoints.find(p => p.client_id === point.client_id);
      if (savedPoint) {
        console.log('✅ Point successfully saved and retrieved from feature');
      } else {
        console.error('❌ Point not found in feature storage after save!');
      }
      
      // Get actual count of unsynced points after save
      const unsyncedPoints = await storageService.getUnsyncedPoints();
      setSyncStatus(prev => ({
        ...prev,
        unsyncedCount: unsyncedPoints.length
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
      if (result.success && clearFeatures && activeProject) {
        console.log('Sync successful, refreshing map...');
        clearFeatures();
        const features = await storageService.getProjectFeatures(activeProject.id);
        console.log(`Loaded ${features.length} features from storage after sync`);
        
        // Render each feature on the map
        features.forEach(feature => {
          if (!feature.points || feature.points.length === 0) {
            console.log(`Skipping feature ${feature.id} - no points`);
            return;
          }

          // For point features, we need to render each point individually
          if (feature.attributes?.featureType === 'Point') {
            feature.points.forEach(point => {
              if (!point.coordinates || point.coordinates.length < 2) {
                console.log(`Skipping point ${point.client_id} - invalid coordinates`);
                return;
              }
              
              const featureToRender: FeatureToRender = {
                type: feature.attributes?.featureType,
                coordinates: point.coordinates as [number, number],
                properties: {
                  featureId: feature.id,
                  featureTypeId: feature.attributes?.featureTypeId,
                  name: feature.attributes?.name,
                  category: feature.attributes?.category,
                  style: feature.attributes?.style
                }
              };
              renderFeature(featureToRender);
            });
          } else {
            // For lines/polygons, use all point coordinates
            const coordinates = feature.points
              .filter(point => point.coordinates && point.coordinates.length === 2)
              .map(point => point.coordinates as [number, number]);
            
            if (coordinates.length < 2) {
              console.log(`Skipping feature ${feature.id} - not enough valid points`);
              return;
            }
            
            const featureToRender: FeatureToRender = {
              type: feature.attributes?.featureType,
              coordinates: coordinates,
              properties: {
                featureId: feature.id,
                featureTypeId: feature.attributes?.featureTypeId,
                name: feature.attributes?.name,
                category: feature.attributes?.category,
                style: feature.attributes?.style
              }
            };
            renderFeature(featureToRender);
          }
        });
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