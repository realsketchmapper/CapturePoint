import { api } from '@/api/clients';
import { API_ENDPOINTS } from '@/api/endpoints';
import { storageService } from '../storage/storageService';
import { syncService } from './syncService';
import { collectedFeatureService } from '../features/collectedFeatureService';
import NetInfo from '@react-native-community/netinfo';
import { PointCollected } from '@/types/pointCollected.types';
import { generateId } from '@/utils/collections';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiFeature } from '@/types/currentFeatures.types';

// Storage key for last sync timestamp
const LAST_SYNC_TIMESTAMP_KEY = 'last_sync_timestamp';

/**
 * Interface representing the result of a bi-directional sync operation
 */
export interface BiDirectionalSyncResult {
  success: boolean;
  localToServerSynced: number;
  serverToLocalSynced: number;
  failedCount: number;
  errorMessage?: string;
}

/**
 * Service for handling bi-directional syncing between local storage and server
 */
class BiDirectionalSyncService {
  /**
   * Checks if the device is online
   * @returns Promise resolving to boolean indicating online status
   */
  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
  }

  /**
   * Gets the timestamp of the last successful sync
   * @returns Promise resolving to the last sync timestamp or null if never synced
   */
  async getLastSyncTimestamp(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(LAST_SYNC_TIMESTAMP_KEY);
    } catch (error) {
      console.error('Error getting last sync timestamp:', error);
      return null;
    }
  }

  /**
   * Updates the timestamp of the last successful sync
   * @returns Promise resolving when the timestamp is updated
   */
  async updateLastSyncTimestamp(): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      await AsyncStorage.setItem(LAST_SYNC_TIMESTAMP_KEY, timestamp);
    } catch (error) {
      console.error('Error updating last sync timestamp:', error);
    }
  }

  /**
   * Syncs features from the server to local storage for a specific project
   * @param projectId - The project ID to sync features for
   * @returns Promise resolving to the number of features synced from server to local
   */
  async syncFromServerToLocal(projectId: number): Promise<number> {
    try {
      console.log('=== Starting syncFromServerToLocal ===');
      console.log('Project ID:', projectId);
      
      // Verify project ID
      if (!projectId) {
        console.log('Sync failed: No project ID provided');
        return 0;
      }
      
      // Check if online
      const online = await this.isOnline();
      console.log('Online status:', online);
      if (!online) {
        console.log('Sync failed: Device is offline');
        return 0;
      }
      
      // Fetch active features from server
      const activeFeatures = await collectedFeatureService.fetchActiveFeatures(projectId);
      console.log('Active features from server:', activeFeatures.length);
      
      if (activeFeatures.length === 0) {
        console.log('No features to sync from server');
        return 0;
      }
      
      // Get existing points from local storage
      const existingPoints = await storageService.getAllPoints();
      const existingPointMap = new Map(
        existingPoints.map(point => [point.client_id, point])
      );
      
      // Track new and updated features
      const newFeatures: PointCollected[] = [];
      const updatedFeatures: PointCollected[] = [];
      
      // Process each feature from the server
      for (const feature of activeFeatures) {
        // Get the first point's coordinates if available
        const firstPoint = feature.properties?.points?.[0];
        console.log('Processing feature for sync:', JSON.stringify(feature, null, 2));
        console.log('First point data:', JSON.stringify(firstPoint, null, 2));
        
        // Extract coordinates from the first point
        const coordinates = firstPoint?.coordinates || [0, 0];
        
        // Ensure coordinates are in [longitude, latitude] format
        // Server sends coordinates in [longitude, latitude] format
        const [longitude, latitude] = coordinates;
        
        // Convert ApiFeature to PointCollected
        const pointCollected: PointCollected = {
          client_id: feature.properties?.client_id || generateId(),
          name: feature.featureType?.name || 'Unknown Feature',
          description: feature.featureType?.description || 'No description available',
          draw_layer: feature.data?.draw_layer || feature.featureType?.draw_layer || 'default',
          nmeaData: {
            gga: {
              latitude: latitude,
              longitude: longitude,
              altitude: firstPoint?.altitude || 0,
              altitudeUnit: 'M',
              geoidHeight: 0,
              geoidHeightUnit: 'M',
              hdop: 0,
              quality: 0,
              satellites: 0,
              time: new Date().toISOString()
            },
            gst: {
              latitudeError: 0,
              longitudeError: 0,
              heightError: 0,
              time: new Date().toISOString(),
              rmsTotal: 0,
              semiMajor: 0,
              semiMinor: 0,
              orientation: 0
            }
          },
          attributes: {
            featureTypeName: feature.featureType?.name || 'Unknown Feature'
          },
          created_by: feature.created_by?.toString() || '1',
          created_at: feature.created_at || new Date().toISOString(),
          updated_at: feature.updated_at || new Date().toISOString(),
          updated_by: feature.updated_by?.toString() || '1',
          synced: true,
          feature_id: Number(feature.featureTypeId) || 0,
          project_id: projectId
        };
        
        console.log('Feature type info:', {
          name: feature.featureType?.name,
          id: feature.featureTypeId,
          type: feature.featureType,
          draw_layer: feature.data?.draw_layer || feature.featureType?.draw_layer
        });
        console.log('Converted to PointCollected:', JSON.stringify(pointCollected, null, 2));
        
        const existingPoint = existingPointMap.get(pointCollected.client_id);
        
        if (!existingPoint) {
          // This is a new feature from the server
          newFeatures.push(pointCollected);
        } else {
          // Check if the server version is newer
          const serverUpdatedAt = new Date(feature.updated_at || '').getTime();
          const localUpdatedAt = new Date(existingPoint.updated_at).getTime();
          
          if (serverUpdatedAt > localUpdatedAt) {
            // Server version is newer, update local
            updatedFeatures.push(pointCollected);
          }
        }
      }
      
      console.log('New features to add:', newFeatures.length);
      console.log('Features to update:', updatedFeatures.length);
      
      // Add new features to local storage
      for (const feature of newFeatures) {
        await storageService.savePoint(feature);
      }
      
      // Update existing features in local storage
      for (const feature of updatedFeatures) {
        await storageService.updatePoint(feature);
      }
      
      console.log('=== Server to local sync completed ===');
      return newFeatures.length + updatedFeatures.length;
    } catch (error) {
      console.error('Error in syncFromServerToLocal:', error);
      return 0;
    }
  }
  
  /**
   * Performs a complete bi-directional sync for a specific project
   * @param projectId - The project ID to sync
   * @returns Promise resolving to BiDirectionalSyncResult
   */
  async syncProject(projectId: number): Promise<BiDirectionalSyncResult> {
    try {
      console.log('=== Starting bi-directional sync for project:', projectId);
      
      // Check if online
      const online = await this.isOnline();
      if (!online) {
        return {
          success: false,
          localToServerSynced: 0,
          serverToLocalSynced: 0,
          failedCount: 0,
          errorMessage: 'Device is offline'
        };
      }
      
      // Step 1: Sync from local to server
      const localToServerResult = await syncService.syncPoints(projectId);
      
      // Step 2: Sync from server to local
      const serverToLocalSynced = await this.syncFromServerToLocal(projectId);
      
      // Update last sync timestamp
      await this.updateLastSyncTimestamp();
      
      console.log('=== Bi-directional sync completed ===');
      return {
        success: localToServerResult.success,
        localToServerSynced: localToServerResult.syncedCount,
        serverToLocalSynced,
        failedCount: localToServerResult.failedCount,
        errorMessage: localToServerResult.errorMessage
      };
    } catch (error) {
      console.error('Error in syncProject:', error);
      return {
        success: false,
        localToServerSynced: 0,
        serverToLocalSynced: 0,
        failedCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Performs a complete bi-directional sync for all projects
   * @returns Promise resolving to BiDirectionalSyncResult
   */
  async syncAllProjects(): Promise<BiDirectionalSyncResult> {
    try {
      console.log('=== Starting bi-directional sync for all projects ===');
      
      // Check if online
      const online = await this.isOnline();
      if (!online) {
        return {
          success: false,
          localToServerSynced: 0,
          serverToLocalSynced: 0,
          failedCount: 0,
          errorMessage: 'Device is offline'
        };
      }
      
      // Step 1: Sync from local to server for all projects
      const localToServerResult = await syncService.syncAllPoints();
      
      // Step 2: Get all projects and sync each one from server to local
      const projectsResponse = await api.get(API_ENDPOINTS.PROJECTS);
      if (!projectsResponse.data.success) {
        throw new Error('Failed to fetch projects');
      }
      
      const projects = projectsResponse.data.projects || [];
      let totalServerToLocalSynced = 0;
      
      for (const project of projects) {
        const syncedCount = await this.syncFromServerToLocal(project.id);
        totalServerToLocalSynced += syncedCount;
      }
      
      // Update last sync timestamp
      await this.updateLastSyncTimestamp();
      
      console.log('=== Bi-directional sync for all projects completed ===');
      return {
        success: localToServerResult.success,
        localToServerSynced: localToServerResult.syncedCount,
        serverToLocalSynced: totalServerToLocalSynced,
        failedCount: localToServerResult.failedCount,
        errorMessage: localToServerResult.errorMessage
      };
    } catch (error) {
      console.error('Error in syncAllProjects:', error);
      return {
        success: false,
        localToServerSynced: 0,
        serverToLocalSynced: 0,
        failedCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const biDirectionalSyncService = new BiDirectionalSyncService(); 