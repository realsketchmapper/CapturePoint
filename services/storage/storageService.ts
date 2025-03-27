// services/storage/storageService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PointCollected, CollectedFeature } from '@/types/pointCollected.types';
import { UtilityFeatureType } from '@/types/features.types';
import { STORAGE_KEYS } from '@/constants/storage';

interface SyncMetadata {
  lastSyncTime: string;
  activeProjects: number[];
  projectSyncTimes: Record<number, string>; // projectId -> last sync time
}

export const storageService = {
  // Project management
  addActiveProject: async (projectId: number): Promise<void> => {
    try {
      const activeProjects = await storageService.getActiveProjects();
      if (!activeProjects.includes(projectId)) {
        activeProjects.push(projectId);
        await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECTS, JSON.stringify(activeProjects));
      }
    } catch (error) {
      console.error('Error adding active project:', error);
      throw error;
    }
  },

  removeActiveProject: async (projectId: number): Promise<void> => {
    try {
      const activeProjects = await storageService.getActiveProjects();
      const updatedProjects = activeProjects.filter(id => id !== projectId);
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECTS, JSON.stringify(updatedProjects));
      
      // Clean up project data if it exists
      const projectKey = `${STORAGE_KEYS.PROJECT_POINTS_PREFIX}${projectId}`;
      const projectData = await AsyncStorage.getItem(projectKey);
      if (projectData) {
        await AsyncStorage.removeItem(projectKey);
      }
    } catch (error) {
      console.error('Error removing active project:', error);
      throw error;
    }
  },

  getActiveProjects: async (): Promise<number[]> => {
    try {
      const projectsJson = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_PROJECTS);
      return projectsJson ? JSON.parse(projectsJson) : [];
    } catch (error) {
      console.error('Error getting active projects:', error);
      return [];
    }
  },

  // Feature management
  saveFeature: async (feature: CollectedFeature): Promise<void> => {
    try {
      console.log('Saving feature:', feature);
      const featuresKey = `${STORAGE_KEYS.PROJECT_FEATURES_PREFIX}${feature.project_id}`;
      const featuresJson = await AsyncStorage.getItem(featuresKey);
      const features: CollectedFeature[] = featuresJson ? JSON.parse(featuresJson) : [];
      
      // Find existing feature index
      const existingIndex = features.findIndex(f => f.client_id === feature.client_id);
      
      if (existingIndex >= 0) {
        // Update existing feature while preserving its points
        const existingPoints = features[existingIndex].points || [];
        features[existingIndex] = {
          ...features[existingIndex],
          ...feature,
          points: feature.points || existingPoints,
          updated_at: new Date().toISOString()
        };
      } else {
        // Add new feature
        features.push({
          ...feature,
          points: feature.points || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      
      // Save with verification
      let saveAttempts = 0;
      const maxAttempts = 3;
      let savedSuccessfully = false;

      while (saveAttempts < maxAttempts && !savedSuccessfully) {
        try {
          await AsyncStorage.setItem(featuresKey, JSON.stringify(features));
          
          // Verify save
          const verifyJson = await AsyncStorage.getItem(featuresKey);
          const verifyFeatures = verifyJson ? JSON.parse(verifyJson) : [];
          const savedFeature = verifyFeatures.find((f: CollectedFeature) => f.client_id === feature.client_id);
          
          if (savedFeature) {
            console.log('Feature verified in storage');
            savedSuccessfully = true;
          } else {
            console.error('Feature verification failed, retrying...');
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`Save attempt ${saveAttempts + 1} failed:`, error);
        }
        saveAttempts++;
      }

      if (!savedSuccessfully) {
        throw new Error('Failed to save feature after multiple attempts');
      }

      console.log(`Saved feature to storage. Total features: ${features.length}`);
    } catch (error) {
      console.error('Error saving feature:', error);
      throw error;
    }
  },

  // Point management with feature relationship
  savePoint: async (point: PointCollected, feature?: CollectedFeature): Promise<void> => {
    try {
      console.log('\n=== Saving Point ===');
      console.log('Initial point data:', point);
      
      // Use NMEA coordinates if available
      if (point.attributes?.nmeaData?.gga) {
        const gga = point.attributes.nmeaData.gga;
        if (typeof gga.longitude === 'number' && typeof gga.latitude === 'number') {
          point.coordinates = [gga.longitude, gga.latitude];
          console.log('Using NMEA coordinates:', point.coordinates);
        }
      }
      
      // Ensure project is in active projects
      await storageService.addActiveProject(point.project_id);
      
      // Get the feature type
      const featureType = await storageService.getFeatureType(point.attributes.featureTypeId, point.project_id);
      if (!featureType) {
        throw new Error(`Feature type ${point.attributes.featureTypeId} not found for project ${point.project_id}`);
      }
      
      // If no feature provided, create one from point data
      const featureToSave: CollectedFeature = feature || {
        id: 0,
        client_id: `feature_${point.client_id}`,
        featureTypeId: point.attributes.featureTypeId,
        featureType,
        project_id: point.project_id,
        points: [],
        attributes: point.attributes,
        is_active: true,
        created_by: point.created_by,
        created_at: point.created_at,
        updated_by: point.updated_by,
        updated_at: point.updated_at
      };

      // Get existing features
      const featuresKey = `${STORAGE_KEYS.PROJECT_FEATURES_PREFIX}${point.project_id}`;
      console.log('Reading from features key:', featuresKey);
      const featuresJson = await AsyncStorage.getItem(featuresKey);
      console.log('Current features in storage:', featuresJson);
      
      // Initialize features array if null
      const features: CollectedFeature[] = featuresJson ? JSON.parse(featuresJson) : [];
      console.log(`Found ${features.length} existing features`);
      
      // Find or create feature
      const existingFeatureIndex = features.findIndex(f => f.client_id === featureToSave.client_id);
      
      if (existingFeatureIndex >= 0) {
        // Update existing feature's points
        const existingPoints = features[existingFeatureIndex].points || [];
        const pointIndex = existingPoints.findIndex(p => p.client_id === point.client_id);
        
        if (pointIndex >= 0) {
          // Update existing point
          existingPoints[pointIndex] = {
            ...point,
            feature_id: features[existingFeatureIndex].id,
            updated_at: new Date().toISOString()
          };
        } else {
          // Add new point
          existingPoints.push({
            ...point,
            feature_id: features[existingFeatureIndex].id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
        
        features[existingFeatureIndex].points = existingPoints;
        features[existingFeatureIndex].updated_at = new Date().toISOString();
      } else {
        // Add new feature with this point
        features.push({
          ...featureToSave,
          points: [point],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      
      // Save features with verification
      let saveAttempts = 0;
      const maxAttempts = 3;
      let savedSuccessfully = false;

      while (saveAttempts < maxAttempts && !savedSuccessfully) {
        try {
          await AsyncStorage.setItem(featuresKey, JSON.stringify(features));
          
          // Verify save
          const verifyJson = await AsyncStorage.getItem(featuresKey);
          const verifyFeatures = verifyJson ? JSON.parse(verifyJson) : [];
          const savedFeature = verifyFeatures.find((f: CollectedFeature) => f.client_id === featureToSave.client_id);
          
          if (savedFeature) {
            const savedPoint = savedFeature.points.find((p: PointCollected) => p.client_id === point.client_id);
            if (savedPoint) {
              console.log('Point verified in storage');
              savedSuccessfully = true;
            } else {
              console.error('Point verification failed, retrying...');
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } else {
            console.error('Feature verification failed, retrying...');
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`Save attempt ${saveAttempts + 1} failed:`, error);
        }
        saveAttempts++;
      }

      if (!savedSuccessfully) {
        throw new Error('Failed to save point after multiple attempts');
      }

      console.log('✨ Successfully saved point to storage');
      console.log('=== Save Point Complete ===\n');
    } catch (error) {
      console.error('❌ Error saving point:', error);
      throw error;
    }
  },

  getFeaturePoints: async (featureId: number, projectId: number): Promise<PointCollected[]> => {
    try {
      const featuresKey = `${STORAGE_KEYS.PROJECT_FEATURES_PREFIX}${projectId}`;
      const featuresJson = await AsyncStorage.getItem(featuresKey);
      if (!featuresJson) return [];
      
      const features: CollectedFeature[] = JSON.parse(featuresJson);
      const feature = features.find(f => f.id === featureId);
      
      // If feature is inactive or not found, return empty array
      if (!feature || !feature.is_active) return [];
      
      // Return only active points
      return (feature.points || []).filter(p => p.is_active);
    } catch (error) {
      console.error('Error getting feature points:', error);
      return [];
    }
  },

  getProjectFeatures: async (projectId: number): Promise<CollectedFeature[]> => {
    try {
      console.log(`Getting features for project ${projectId}`);
      const featuresKey = `${STORAGE_KEYS.PROJECT_FEATURES_PREFIX}${projectId}`;
      const featuresJson = await AsyncStorage.getItem(featuresKey);
      
      console.log('Features from storage:', {
        key: featuresKey,
        hasData: !!featuresJson,
        rawData: featuresJson
      });

      if (!featuresJson) {
        console.log('No features found in storage');
        return [];
      }

      const features: CollectedFeature[] = JSON.parse(featuresJson);
      console.log(`Found ${features.length} features:`, features.map(f => ({
        id: f.id,
        client_id: f.client_id,
        name: f.featureType?.name || 'Unknown feature',
        pointCount: f.points?.length || 0
      })));

      return features;
    } catch (error) {
      console.error('Error getting project features:', error);
      return [];
    }
  },

  getUnsyncedFeatures: async (projectId: number): Promise<CollectedFeature[]> => {
    try {
      const features = await storageService.getProjectFeatures(projectId);
      // Filter features that haven't been synced (id=0 or null) or have unsynced points
      return features.filter(f => {
        // Feature is unsynced if:
        // 1. It has no server ID (id is null or 0)
        const isFeatureUnsynced = !f.id || f.id === 0;
        
        // 2. It has points that are unsynced (point.id is null)
        const hasUnsyncedPoints = f.points.some(p => p.id === null);
        
        return isFeatureUnsynced || hasUnsyncedPoints;
      });
    } catch (error) {
      console.error('Error getting unsynced features:', error);
      return [];
    }
  },

  getProjectPoints: async (projectId: number): Promise<PointCollected[]> => {
    try {
      console.log('\n=== Getting Project Points ===');
      const featuresKey = `${STORAGE_KEYS.PROJECT_FEATURES_PREFIX}${projectId}`;
      console.log('Reading from features key:', featuresKey);
      
      const featuresJson = await AsyncStorage.getItem(featuresKey);
      console.log('Features data:', featuresJson);
      
      if (!featuresJson) {
        console.log('No features found in storage');
        return [];
      }
      
      const features: CollectedFeature[] = JSON.parse(featuresJson);
      console.log(`Found ${features.length} features`);
      
      const points: PointCollected[] = [];
      
      // Only collect points from active features
      features.forEach((feature: CollectedFeature) => {
        if (feature.is_active && feature.points && Array.isArray(feature.points)) {
          // Only add active points
          const activePoints = feature.points.filter(p => p.is_active);
          console.log(`Adding ${activePoints.length} active points from feature ${feature.client_id}`);
          points.push(...activePoints);
        }
      });
      
      console.log(`Total active points found: ${points.length}`);
      return points;
    } catch (error) {
      console.error('Error getting project points:', error);
      return [];
    }
  },

  getAllPoints: async (): Promise<PointCollected[]> => {
    try {
      // Get all active projects
      const activeProjects = await storageService.getActiveProjects();
      let allPoints: PointCollected[] = [];
      
      // Get points from each project
      for (const projectId of activeProjects) {
        const projectPoints = await storageService.getProjectPoints(projectId);
        allPoints = allPoints.concat(projectPoints);
      }
      
      return allPoints;
    } catch (error) {
      console.error('Error getting all points:', error);
      return [];
    }
  },

  getUnsyncedPoints: async (): Promise<PointCollected[]> => {
    try {
      const points = await storageService.getAllPoints();
      // Filter points that haven't been synced (id is null)
      return points.filter(p => p.id === null);
    } catch (error) {
      console.error('Error getting unsynced points:', error);
      return [];
    }
  },

  getUnsyncedPointsForProject: async (projectId: number): Promise<PointCollected[]> => {
    try {
      const points = await storageService.getProjectPoints(projectId);
      // Filter points that haven't been synced (id is null)
      return points.filter(p => p.id === null);
    } catch (error) {
      console.error('Error getting unsynced points for project:', error);
      return [];
    }
  },

  markPointsAsSynced: async (pointIds: string[], projectId: number): Promise<void> => {
    try {
      const projectPoints = await storageService.getProjectPoints(projectId);
      const updatedPoints = projectPoints.map(point => 
        point.id !== null && pointIds.includes(point.id.toString()) ? { ...point, synced: true } : point
      );
      
      const projectKey = `${STORAGE_KEYS.PROJECT_POINTS_PREFIX}${projectId}`;
      await AsyncStorage.setItem(projectKey, JSON.stringify(updatedPoints));
      
      // Update sync metadata
      await storageService.updateSyncMetadata(projectId);
    } catch (error) {
      console.error('Error marking points as synced:', error);
      throw error;
    }
  },

  deletePoint: async (pointId: number, projectId: number): Promise<boolean> => {
    try {
      const projectPoints = await storageService.getProjectPoints(projectId);
      const filteredPoints = projectPoints.filter(point => point.id !== pointId);
      
      if (projectPoints.length === filteredPoints.length) {
        return false; // Point not found
      }
      
      const projectKey = `${STORAGE_KEYS.PROJECT_POINTS_PREFIX}${projectId}`;
      await AsyncStorage.setItem(projectKey, JSON.stringify(filteredPoints));
      return true;
    } catch (error) {
      console.error('Error deleting point:', error);
      return false;
    }
  },

  // Sync metadata management
  getSyncMetadata: async (): Promise<SyncMetadata> => {
    try {
      const metadataJson = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_METADATA);
      return metadataJson ? JSON.parse(metadataJson) : {
        lastSyncTime: '',
        activeProjects: [],
        projectSyncTimes: {}
      };
    } catch (error) {
      console.error('Error getting sync metadata:', error);
      return {
        lastSyncTime: '',
        activeProjects: [],
        projectSyncTimes: {}
      };
    }
  },

  updateSyncMetadata: async (projectId: number): Promise<void> => {
    try {
      const metadata = await storageService.getSyncMetadata();
      const now = new Date().toISOString();
      
      metadata.lastSyncTime = now;
      metadata.projectSyncTimes[projectId] = now;
      
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_METADATA, JSON.stringify(metadata));
    } catch (error) {
      console.error('Error updating sync metadata:', error);
      throw error;
    }
  },

  // Clear all data for testing/debugging
  clearAllData: async (): Promise<void> => {
    try {
      // Get all keys from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Keys to preserve
      const preserveKeys = [
        '@user_credentials',  // Token data
        'locationPermission', // Location permission
        'locationHighAccuracy' // Location accuracy setting
      ];
      
      // Filter out keys to preserve
      const keysToRemove = allKeys.filter(key => !preserveKeys.includes(key));
      
      // Remove all other keys
      await AsyncStorage.multiRemove(keysToRemove);
      
      console.log('All data cleared from AsyncStorage except location and token data');
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  },

  // Get a point by its ID
  getPointById: async (pointId: string): Promise<PointCollected | null> => {
    try {
      const pointsJson = await AsyncStorage.getItem('points');
      if (!pointsJson) return null;
      
      const points: PointCollected[] = JSON.parse(pointsJson);
      return points.find(p => p.client_id === pointId) || null;
    } catch (error) {
      console.error('Error getting point by ID:', error);
      return null;
    }
  },

  // Update an existing point with partial or complete data
  updatePoint: async (pointId: string | PointCollected, updatedData?: Partial<PointCollected>): Promise<boolean> => {
    try {
      const pointsJson = await AsyncStorage.getItem('points');
      if (!pointsJson) return false;
      
      const points: PointCollected[] = JSON.parse(pointsJson);
      const id = typeof pointId === 'string' ? pointId : pointId.client_id;
      
      const index = points.findIndex(p => p.client_id === id);
      if (index === -1) return false;
      
      points[index] = {
        ...points[index],
        ...(updatedData || {}),
        updated_at: new Date().toISOString()
      };
      
      await AsyncStorage.setItem('points', JSON.stringify(points));
      return true;
    } catch (error) {
      console.error('Error updating point:', error);
      return false;
    }
  },

  // Add a new point
  addPoint: async (point: PointCollected): Promise<boolean> => {
    try {
      // Add project to active projects if not already there
      await storageService.addActiveProject(point.project_id);
      
      // Use savePoint which will handle feature creation
      await storageService.savePoint(point);
      
      console.log(`Point added locally with ID: ${point.client_id} for project: ${point.project_id}`);
      return true;
    } catch (error) {
      console.error('Error adding point:', error);
      return false;
    }
  },

  // Clear all points for a specific project
  clearAllPoints: async (projectId: number): Promise<void> => {
    try {
      console.log('\n=== Starting Clear All Points ===');
      console.log(`🗑️ Clearing all points for project ${projectId}`);
      
      // Log current storage state
      const featuresKey = `${STORAGE_KEYS.PROJECT_FEATURES_PREFIX}${projectId}`;
      const legacyPointsJson = await AsyncStorage.getItem('points');
      const featuresJson = await AsyncStorage.getItem(featuresKey);
      
      console.log('📊 Current Storage State:');
      console.log('Legacy points storage:', legacyPointsJson ? JSON.parse(legacyPointsJson) : 'Empty');
      console.log(`Project ${projectId} features:`, featuresJson ? JSON.parse(featuresJson) : 'Empty');
      
      // Remove data from all storage locations
      await AsyncStorage.removeItem('points'); // Clear legacy points
      await AsyncStorage.removeItem(featuresKey); // Clear features (which contain points)
      
      // Clear sync metadata for this project
      const syncMetadataJson = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_METADATA);
      if (syncMetadataJson) {
        console.log('📊 Current Sync Metadata:', JSON.parse(syncMetadataJson));
        const syncMetadata = JSON.parse(syncMetadataJson);
        if (syncMetadata.projectSyncTimes) {
          delete syncMetadata.projectSyncTimes[projectId];
          await AsyncStorage.setItem(STORAGE_KEYS.SYNC_METADATA, JSON.stringify(syncMetadata));
        }
      }
      
      // Clear last sync time for this project
      await AsyncStorage.removeItem(`${STORAGE_KEYS.LAST_SYNC_TIME}_${projectId}`);
      
      // Verify deletion
      const afterFeaturesJson = await AsyncStorage.getItem(featuresKey);
      const afterPointsJson = await AsyncStorage.getItem('points');
      
      console.log('\n📊 Storage State After Clearing:');
      console.log('Legacy points storage:', afterPointsJson || 'Empty');
      console.log(`Project ${projectId} features:`, afterFeaturesJson || 'Empty');
      
      // If any data still exists, try one more time to force clear
      if (afterFeaturesJson || afterPointsJson) {
        console.log('⚠️ Some data still exists, forcing clear...');
        await AsyncStorage.removeItem('points');
        await AsyncStorage.removeItem(featuresKey);
        
        // Final verification
        const finalFeaturesJson = await AsyncStorage.getItem(featuresKey);
        const finalPointsJson = await AsyncStorage.getItem('points');
        
        if (finalFeaturesJson || finalPointsJson) {
          throw new Error('Failed to clear all data after multiple attempts');
        }
      }
      
      // Check if project should be removed from active projects
      const remainingFeatures = await AsyncStorage.getItem(featuresKey);
      if (!remainingFeatures) {
        console.log('No remaining features, removing project from active projects list');
        const activeProjects = await storageService.getActiveProjects();
        const updatedProjects = activeProjects.filter(id => id !== projectId);
        await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECTS, JSON.stringify(updatedProjects));
      }
      
      console.log('✨ Successfully cleared all points and related data for project', projectId);
      console.log('=== Clear All Points Complete ===\n');
    } catch (error) {
      console.error('❌ Error clearing points:', error);
      throw error;
    }
  },

  // Update point in feature
  updatePointInFeature: async (point: PointCollected): Promise<boolean> => {
    try {
      // Use savePoint instead as it handles all the necessary updates
      await storageService.savePoint(point);
      return true;
    } catch (error) {
      console.error('Error updating point in feature:', error);
      return false;
    }
  },

  removeFeature: async (featureId: number, projectId: number): Promise<void> => {
    try {
      console.log(`\n=== Removing Feature ${featureId} from Project ${projectId} ===`);
      const featuresKey = `${STORAGE_KEYS.PROJECT_FEATURES_PREFIX}${projectId}`;
      
      // Get current features
      const featuresJson = await AsyncStorage.getItem(featuresKey);
      console.log('Current features:', featuresJson);
      
      if (!featuresJson) {
        console.log('No features found in storage');
        return;
      }
      
      const features: CollectedFeature[] = JSON.parse(featuresJson);
      console.log(`Found ${features.length} features`);
      
      // Find the feature to remove
      const featureToRemove: CollectedFeature | undefined = features.find(f => f.id === featureId);
      if (!featureToRemove) {
        console.log('Feature not found');
        return;
      }
      
      const featureName = featureToRemove.featureType?.name || 'Unknown feature';
      console.log('Removing feature:', featureName);
      
      // Mark all points as inactive before removing
      if (featureToRemove.points && featureToRemove.points.length > 0) {
        console.log(`Marking ${featureToRemove.points.length} points as inactive`);
        for (const point of featureToRemove.points) {
          await storageService.updatePointInFeature({
            ...point,
            is_active: false
          });
        }
      }
      
      const updatedFeatures = features.filter(f => f.id !== featureId);
      
      // Save updated features
      await AsyncStorage.setItem(featuresKey, JSON.stringify(updatedFeatures));
      console.log(`Saved ${updatedFeatures.length} remaining features`);
      
      // Verify the save
      const verifyJson = await AsyncStorage.getItem(featuresKey);
      const verifyFeatures = verifyJson ? JSON.parse(verifyJson) : [];
      console.log(`Verification: ${verifyFeatures.length} features in storage`);
      
      // If no features left, remove project from active projects
      if (updatedFeatures.length === 0) {
        console.log('No features remaining, removing project from active projects');
        await storageService.removeActiveProject(projectId);
      }
      
      console.log('=== Feature Removal Complete ===\n');
    } catch (error) {
      console.error('Error removing feature:', error);
      throw error;
    }
  },

  // Feature type management
  saveFeatureType: async (featureType: UtilityFeatureType, projectId: number): Promise<void> => {
    try {
      const featureTypesKey = `${STORAGE_KEYS.PROJECT_FEATURE_TYPES_PREFIX}${projectId}`;
      const featureTypesJson = await AsyncStorage.getItem(featureTypesKey);
      const featureTypes: UtilityFeatureType[] = featureTypesJson ? JSON.parse(featureTypesJson) : [];
      
      // Find existing feature type index
      const existingIndex = featureTypes.findIndex(ft => ft.id === featureType.id);
      
      if (existingIndex >= 0) {
        // Update existing feature type
        featureTypes[existingIndex] = featureType;
      } else {
        // Add new feature type
        featureTypes.push(featureType);
      }
      
      await AsyncStorage.setItem(featureTypesKey, JSON.stringify(featureTypes));
    } catch (error) {
      console.error('Error saving feature type:', error);
      throw error;
    }
  },

  getFeatureTypes: async (projectId: number): Promise<UtilityFeatureType[]> => {
    try {
      const featureTypesKey = `${STORAGE_KEYS.PROJECT_FEATURE_TYPES_PREFIX}${projectId}`;
      const featureTypesJson = await AsyncStorage.getItem(featureTypesKey);
      return featureTypesJson ? JSON.parse(featureTypesJson) : [];
    } catch (error) {
      console.error('Error getting feature types:', error);
      return [];
    }
  },

  getFeatureType: async (featureTypeId: number, projectId: number): Promise<UtilityFeatureType | null> => {
    try {
      const featureTypes = await storageService.getFeatureTypes(projectId);
      return featureTypes.find(ft => ft.id === featureTypeId) || null;
    } catch (error) {
      console.error('Error getting feature type:', error);
      return null;
    }
  },

  removeFeatureType: async (featureTypeId: number, projectId: number): Promise<void> => {
    try {
      const featureTypesKey = `${STORAGE_KEYS.PROJECT_FEATURE_TYPES_PREFIX}${projectId}`;
      const featureTypesJson = await AsyncStorage.getItem(featureTypesKey);
      const featureTypes: UtilityFeatureType[] = featureTypesJson ? JSON.parse(featureTypesJson) : [];
      
      const updatedFeatureTypes = featureTypes.filter(ft => ft.id !== featureTypeId);
      await AsyncStorage.setItem(featureTypesKey, JSON.stringify(updatedFeatureTypes));
    } catch (error) {
      console.error('Error removing feature type:', error);
      throw error;
    }
  },
};