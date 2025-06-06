import { api } from '@/api/clients';
import { API_ENDPOINTS } from '@/api/endpoints';
import { featureStorageService } from '../storage/featureStorageService';
import NetInfo from '@react-native-community/netinfo';
import { PointCollected, PointData } from '@/types/pointCollected.types';
import { AxiosError } from 'axios';
import { syncLogger } from '../logging/syncLogger';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CollectedFeature } from '@/types/currentFeatures.types';

/**
 * Interface representing the result of a sync operation
 */
export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errorMessage?: string;
}

/**
 * Interface for the formatted point data sent to the API
 */
interface FormattedPoint {
  clientId: string;
  lastModified: string;
  data: {
    name: string;
    description: string;
    category: number;
    type: string;
    draw_layer: string;
    points: {
      client_id: string;
      coords: [number, number];
      created_at: string;
      updated_at: string;
      attributes: Record<string, any>;
    }[];
    created_at: string;
    updated_at: string;
    attributes: Record<string, any>;
  }
}

/**
 * Service for handling all sync operations
 * Manages both background and manual sync
 */
class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private currentProjectId: number | null = null;
  private appState: AppStateStatus = 'active';
  private appStateSubscription: { remove: () => void } | null = null;

  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 second
  private readonly MAX_RETRY_DELAY = 30000; // 30 seconds

  /**
   * Standardizes a datetime string to ISO format without timezone offset
   * @param date - Date string or Date object
   * @returns ISO string without timezone offset
   */
  private standardizeDateTime(date: string | Date): string {
    try {
      if (!date) {
        return new Date().toISOString().split('.')[0] + 'Z';
      }
      
      // If it's already a Date object, use it directly
      if (date instanceof Date) {
        return date.toISOString().split('.')[0] + 'Z';
      }
      
      // Handle NMEA time format (HHMMSS.ss)
      if (/^\d{6}\.\d{2}$/.test(date)) {
        const hours = parseInt(date.substring(0, 2));
        const minutes = parseInt(date.substring(2, 4));
        const seconds = parseFloat(date.substring(4));
        const now = new Date();
        now.setHours(hours, minutes, seconds);
        return now.toISOString().split('.')[0] + 'Z';
      }
      
      // Try to parse the date string
      const parsedDate = new Date(date);
      
      // Check if the date is valid
      if (isNaN(parsedDate.getTime())) {
        console.warn('Invalid date string:', date);
        return new Date().toISOString().split('.')[0] + 'Z';
      }
      
      return parsedDate.toISOString().split('.')[0] + 'Z';
    } catch (error) {
      console.warn('Error standardizing date:', error);
      return new Date().toISOString().split('.')[0] + 'Z';
    }
  }

  /**
   * Standardizes all datetime values in a point object
   * @param point - The point to standardize
   * @returns Point with standardized datetime values
   */
  private standardizePointDatetimes(point: PointCollected): PointCollected {
    const standardizedPoint: PointCollected = {
      ...point,
      created_at: this.standardizeDateTime(point.created_at),
      updated_at: this.standardizeDateTime(point.updated_at)
    };

    if (point.points) {
      standardizedPoint.points = point.points.map(p => {
        const standardizedPointData: PointData = {
          ...p,
          created_at: this.standardizeDateTime(p.created_at),
          updated_at: this.standardizeDateTime(p.updated_at)
        };

        if (p.attributes?.nmeaData) {
          const nmeaData = { ...p.attributes.nmeaData };
          
          if (nmeaData.gga) {
            nmeaData.gga = {
              ...nmeaData.gga,
              time: this.standardizeDateTime(nmeaData.gga.time)
            };
          }
          
          if (nmeaData.gst) {
            nmeaData.gst = {
              ...nmeaData.gst,
              time: this.standardizeDateTime(nmeaData.gst.time)
            };
          }

          standardizedPointData.attributes = {
            ...p.attributes,
            nmeaData
          };
        }

        return standardizedPointData;
      });
    }

    return standardizedPoint;
  }

  constructor() {
    // Listen to app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (this.appState === 'active' && nextAppState === 'background') {
      // App is going to background, perform final sync
      this.syncBeforeClose();
    }
    this.appState = nextAppState;
  };

  /**
   * Starts the background sync service for a specific project
   * @param projectId - The project ID to sync
   */
  start(projectId: number) {
    this.currentProjectId = projectId;
    this.syncInterval = setInterval(() => this.autoSync(), this.SYNC_INTERVAL);
    
    // Initial sync
    this.autoSync();
  }

  /**
   * Stops the background sync service
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.currentProjectId = null;
  }

  /**
   * Performs an automatic sync if conditions are met
   */
  private async autoSync() {
    if (!this.currentProjectId) return;
    
    try {
      await syncLogger.logSyncOperation('auto_sync_start', this.currentProjectId, {
        timestamp: new Date().toISOString()
      });

      const online = await this.isOnline();
      if (!online) {
        await syncLogger.logSyncOperation('auto_sync_offline', this.currentProjectId, {
          error: 'Device is offline'
        });
        return;
      }

      const result = await this.syncProject(this.currentProjectId);
      
      await syncLogger.logSyncOperation('auto_sync_complete', this.currentProjectId, {
        result
      });
    } catch (error) {
      await syncLogger.logSyncOperation('auto_sync_error', this.currentProjectId, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Performs a sync before the app closes
   */
  private async syncBeforeClose() {
    if (!this.currentProjectId) return;

    try {
      await syncLogger.logSyncOperation('close_sync_start', this.currentProjectId, {
        timestamp: new Date().toISOString()
      });

      const online = await this.isOnline();
      if (!online) {
        await syncLogger.logSyncOperation('close_sync_offline', this.currentProjectId, {
          error: 'Device is offline'
        });
        return;
      }

      const result = await this.syncProject(this.currentProjectId);
      
      await syncLogger.logSyncOperation('close_sync_complete', this.currentProjectId, {
        result
      });
    } catch (error) {
      await syncLogger.logSyncOperation('close_sync_error', this.currentProjectId, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Checks if the device is online
   * @returns Promise resolving to boolean indicating online status
   */
  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
  }

  /**
   * Formats a point for API submission
   * @param point - The point to format
   * @returns Formatted point data for API or null if coordinates are missing
   */
  private formatPointForAPI(point: PointCollected): FormattedPoint | null {
    // Extract coordinates from NMEA data
    const longitude = point.attributes?.nmeaData?.gga?.longitude;
    const latitude = point.attributes?.nmeaData?.gga?.latitude;
    
    // Skip points with missing coordinates
    if (longitude === undefined || latitude === undefined || longitude === null || latitude === null) {
      console.warn(`Skipping point ${point.client_id} due to missing coordinates:`, { longitude, latitude });
      return null;
    }
    
    // Check if this is a line point
    const isLinePoint = point.attributes?.isLinePoint === true;
    const parentLineId = point.attributes?.parentLineId;
    
    // Determine the type - if it's a line point and has a parentLineId, we'll mark it as part of a Line
    const featureType = isLinePoint && parentLineId ? 'Line' : 'Point';
    
    // Set the name correctly - if it's a line point, use the parent line's name without the "Point X" suffix
    let name = point.name;
    if (isLinePoint && point.attributes?.featureTypeName) {
      // Use the feature type name instead of "Feature Type Point X"
      name = point.attributes.featureTypeName;
    }
    
    // Create a copy of the attributes without the NMEA data and RTK-Pro data for the feature
    const featureAttributes = { ...point.attributes };
    delete featureAttributes.nmeaData;
    delete featureAttributes.rtkProData; // RTK-Pro data should only be at point level
    
    return {
      clientId: String(point.client_id),
      lastModified: this.standardizeDateTime(point.updated_at),
      data: {
        name: name,
        description: point.description,
        category: point.feature_id,
        type: featureType,
        draw_layer: point.draw_layer,
        points: [{
          client_id: point.client_id,
          coords: [longitude, latitude],
          created_at: this.standardizeDateTime(point.created_at),
          updated_at: this.standardizeDateTime(point.updated_at),
          attributes: {
            ...point.attributes,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            nmeaData: {
              gga: point.attributes?.nmeaData?.gga,
              gst: point.attributes?.nmeaData?.gst
            }
          }
        }],
        created_at: this.standardizeDateTime(point.created_at),
        updated_at: this.standardizeDateTime(point.updated_at),
        attributes: {
          ...featureAttributes,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          isLine: isLinePoint && parentLineId ? true : undefined,
          parentLineId: parentLineId
        }
      }
    };
  }

  /**
   * Format a line feature for API submission
   * @param feature - The line feature to format
   * @returns Formatted line feature data for API or null if invalid
   */
  private formatLineFeatureForAPI(feature: CollectedFeature): FormattedPoint | null {
    // Skip features with no points
    if (!feature.points || feature.points.length < 2) {
      console.warn(`Skipping line feature ${feature.client_id} with insufficient points: ${feature.points?.length || 0}`);
      return null;
    }
    
    // Get all valid points with coordinates
    const validPoints = feature.points.filter((point: PointCollected) => {
      const longitude = point.attributes?.nmeaData?.gga?.longitude;
      const latitude = point.attributes?.nmeaData?.gga?.latitude;
      return longitude !== undefined && latitude !== undefined && longitude !== null && latitude !== null;
    });
    
    // Sort points by their pointIndex attribute to ensure correct line order
    validPoints.sort((a: PointCollected, b: PointCollected) => (a.attributes?.pointIndex || 0) - (b.attributes?.pointIndex || 0));
    
    // Skip if we don't have enough valid points
    if (validPoints.length < 2) {
      console.warn(`Skipping line feature ${feature.client_id} with insufficient valid points: ${validPoints.length}`);
      return null;
    }
    
    // Format all points for inclusion in the line feature
    const formattedPoints = validPoints.map((point: PointCollected) => ({
      client_id: point.client_id,
      coords: [
        point.attributes?.nmeaData?.gga?.longitude,
        point.attributes?.nmeaData?.gga?.latitude
      ] as [number, number],
      created_at: this.standardizeDateTime(point.created_at),
      updated_at: this.standardizeDateTime(point.updated_at),
      attributes: {
        ...point.attributes,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        isLinePoint: true,
        parentLineId: feature.client_id,
        pointIndex: point.attributes?.pointIndex || 0
      }
    }));
    
    // Create a copy of the feature attributes without NMEA data and RTK-Pro data
    const featureAttributes = { ...feature.attributes };
    if (featureAttributes.nmeaData) {
      delete featureAttributes.nmeaData;
    }
    if (featureAttributes.rtkProData) {
      delete featureAttributes.rtkProData; // RTK-Pro data should only be at point level
    }
    
    // Return the formatted line feature
    return {
      clientId: String(feature.client_id),
      lastModified: this.standardizeDateTime(feature.updated_at),
      data: {
        name: feature.name,
        description: feature.points[0]?.description || '',
        category: feature.project_id,
        type: 'Line',
        draw_layer: feature.draw_layer,
        points: formattedPoints,
        created_at: this.standardizeDateTime(feature.created_at),
        updated_at: this.standardizeDateTime(feature.updated_at),
        attributes: {
          ...featureAttributes,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          isLine: true
        }
      }
    };
  }

  /**
   * Executes an operation with retry logic and exponential backoff
   * @param operation - The async operation to execute
   * @param operationName - Name of the operation for logging
   * @private
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    projectId: number
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.INITIAL_RETRY_DELAY;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          await syncLogger.logSyncOperation('retry_success', projectId, {
            operation: operationName,
            attempt,
            delay
          });
        }
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        await syncLogger.logSyncOperation('retry_failed', projectId, {
          operation: operationName,
          attempt,
          error: lastError.message,
          delay
        });

        if (attempt < this.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * 2, this.MAX_RETRY_DELAY);
        }
      }
    }

    throw lastError;
  }

  /**
   * Syncs features from the server to local storage
   * @param projectId - The project ID to sync features for
   * @returns Promise resolving to the number of features synced from server to local
   */
  private async syncFromServerToLocal(projectId: number): Promise<number> {
    console.log('=== Starting syncFromServerToLocal ===');
    console.log('Project ID:', projectId);

    try {
      // Get the last sync timestamp from storage
      const lastSyncTime = await this.getLastSyncTimestamp(projectId);
      const startTime = lastSyncTime || '1970-01-01T00:00:00Z';
      console.log('Using epoch start time for full sync:', startTime);

      // Make the sync request to the server
      const response = await api.post(`/${projectId}/sync`, {
        lastSyncTime: startTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone // Add device timezone
      });

      console.log('Sync response:', response.data);

      if (!response.data.success) {
        throw new Error('Server sync failed');
      }

      const serverChanges = response.data.changes || [];
      console.log('Server changes:', serverChanges.length);

      // Process each change from the server
      for (const change of serverChanges) {
        if (change.deleted) {
          await this.handleDeletedFeature(projectId, change.clientId);
        } else {
          await this.handleServerFeature(projectId, change);
        }
      }

      // Update the last sync timestamp
      const serverTimestamp = response.data.serverTimestamp;
      console.log('Updating last sync timestamp:', serverTimestamp);
      await this.setLastSyncTimestamp(projectId, serverTimestamp);

      console.log('=== Completed syncFromServerToLocal ===');
      console.log('Synced count:', serverChanges.length);
      return serverChanges.length;
    } catch (error) {
      console.error('Error in syncFromServerToLocal:', error);
      throw error;
    }
  }

  private async handleServerFeature(projectId: number, change: any) {
    console.log('Processing server feature:', change.clientId);
    const feature = change.data;

    if (feature.type === 'Point') {
      console.log('Processing point:', change.clientId);
      const point = feature.points[0];
      
      // Convert server timestamps to standardized format
      const standardizedPoint = {
        ...point,
        created_at: this.standardizeDateTime(point.created_at),
        updated_at: this.standardizeDateTime(point.updated_at),
        attributes: {
          ...point.attributes,
          nmeaData: {
            ...point.attributes?.nmeaData,
            gga: point.attributes?.nmeaData?.gga ? {
              ...point.attributes.nmeaData.gga,
              time: this.standardizeDateTime(point.attributes.nmeaData.gga.time)
            } : undefined,
            gst: point.attributes?.nmeaData?.gst ? {
              ...point.attributes.nmeaData.gst,
              time: this.standardizeDateTime(point.attributes.nmeaData.gst.time)
            } : undefined
          }
        }
      };

      // Get existing features
      const existingFeatures = await featureStorageService.getUnsyncedFeatures(projectId);
      console.log('Getting features for project:', projectId);
      console.log('Returning cached features:', existingFeatures.length);

      // Check if the feature already exists
      const existingFeatureIndex = existingFeatures.findIndex(f => f.client_id === change.clientId);
      
      if (existingFeatureIndex >= 0) {
        // Update existing feature
        const pointToSave: PointCollected = {
          client_id: existingFeatures[existingFeatureIndex].client_id,
          name: existingFeatures[existingFeatureIndex].name,
          description: existingFeatures[existingFeatureIndex].points[0]?.description || '',
          draw_layer: existingFeatures[existingFeatureIndex].draw_layer,
          attributes: existingFeatures[existingFeatureIndex].points[0]?.attributes || {},
          created_by: String(existingFeatures[existingFeatureIndex].created_by),
          created_at: standardizedPoint.created_at,
          updated_at: standardizedPoint.updated_at,
          updated_by: String(existingFeatures[existingFeatureIndex].updated_by),
          synced: true,
          feature_id: point.id || 0,
          project_id: projectId
        };
        await featureStorageService.savePoint(pointToSave);
      } else {
        // Add new feature
        const pointToSave: PointCollected = {
          client_id: change.clientId,
          name: feature.name,
          description: feature.description || '',
          draw_layer: feature.draw_layer,
          attributes: standardizedPoint.attributes,
          created_by: String(point.created_by),
          created_at: standardizedPoint.created_at,
          updated_at: standardizedPoint.updated_at,
          updated_by: String(point.updated_by),
          synced: true,
          feature_id: point.id || 0,
          project_id: projectId
        };
        await featureStorageService.savePoint(pointToSave);
      }
    }
  }

  /**
   * Gets the last sync timestamp for a project
   * @param projectId - The project ID
   * @returns Promise resolving to the last sync timestamp or null if not found
   */
  private async getLastSyncTimestamp(projectId: number): Promise<string | null> {
    try {
      const key = `last_sync_${projectId}`;
      const timestamp = await AsyncStorage.getItem(key);
      return timestamp ? this.standardizeDateTime(timestamp) : null;
    } catch (error) {
      console.error('Error getting last sync timestamp:', error);
      return null;
    }
  }

  /**
   * Sets the last sync timestamp for a project
   * @param projectId - The project ID
   * @param timestamp - The timestamp to set
   */
  private async setLastSyncTimestamp(projectId: number, timestamp: string): Promise<void> {
    try {
      const key = `last_sync_${projectId}`;
      await AsyncStorage.setItem(key, this.standardizeDateTime(timestamp));
    } catch (error) {
      console.error('Error setting last sync timestamp:', error);
    }
  }

  /**
   * Syncs features from local storage to server
   * @param projectId - The project ID to sync features for
   * @returns Promise resolving to SyncResult
   */
  private async syncFromLocalToServer(projectId: number): Promise<SyncResult> {
    return this.executeWithRetry(
      async () => {
        await syncLogger.logSyncOperation('local_to_server_start', projectId, {
          timestamp: this.standardizeDateTime(new Date())
        });

        const unsyncedFeatures = await featureStorageService.getUnsyncedFeatures(projectId);
        if (unsyncedFeatures.length === 0) {
          return {
            success: true,
            syncedCount: 0,
            failedCount: 0
          };
        }

        // Separate line features and point features
        const lineFeatures = unsyncedFeatures.filter(feature => 
          feature.type === 'Line' && feature.attributes?.isLine === true
        );
        
        const pointFeatures = unsyncedFeatures.filter(feature => 
          feature.type !== 'Line' || feature.attributes?.isLine !== true
        );
        
        // Format line features correctly
        const formattedLineFeatures = lineFeatures
          .map(feature => this.formatLineFeatureForAPI(feature))
          .filter((feature): feature is FormattedPoint => feature !== null);
        
        // Format individual points that are not part of lines
        const formattedPoints = pointFeatures
          .flatMap(feature => feature.points)
          .filter(point => !point.attributes?.isLinePoint) // Don't include points that belong to lines
          .map(point => this.formatPointForAPI(this.standardizePointDatetimes(point)))
          .filter((point): point is FormattedPoint => point !== null);
        
        // Combine both types of formatted features
        const formattedFeatures = [...formattedLineFeatures, ...formattedPoints];

        if (formattedFeatures.length === 0) {
          return {
            success: true,
            syncedCount: 0,
            failedCount: 0
          };
        }

        // Send features to server
        const endpoint = API_ENDPOINTS.SYNC_COLLECTED_FEATURES.replace(':projectId', projectId.toString());
        const response = await api.post(endpoint, {
          features: formattedFeatures,
          lastSyncTimestamp: this.standardizeDateTime(new Date()),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone // Send client device timezone
        });

        if (response.data && response.data.success) {
          const syncedIds = response.data.processed || [];
          const failedIds = response.data.failed || [];

          // Mark as synced in local storage
          if (syncedIds.length > 0) {
            await featureStorageService.markPointsAsSynced(syncedIds, projectId);
          }

          return {
            success: true,
            syncedCount: syncedIds.length,
            failedCount: failedIds.length
          };
        } else {
          return {
            success: false,
            syncedCount: 0,
            failedCount: formattedFeatures.length,
            errorMessage: response.data?.message || 'Sync failed'
          };
        }
      },
      'syncFromLocalToServer',
      projectId
    );
  }

  /**
   * Performs a complete bi-directional sync for a specific project
   * @param projectId - The project ID to sync
   * @returns Promise resolving to SyncResult
   */
  async syncProject(projectId: number): Promise<SyncResult> {
    try {
      console.log('=== Starting syncProject ===');
      console.log('Project ID:', projectId);
      
      await syncLogger.logSyncOperation('sync_start', projectId, {
        timestamp: new Date().toISOString()
      });

      // Check if online
      const online = await this.isOnline();
      console.log('Online status:', online);
      
      if (!online) {
        console.log('Device is offline, skipping sync');
        await syncLogger.logSyncOperation('sync_offline', projectId, {
          error: 'Device is offline'
        });
        return {
          success: false,
          syncedCount: 0,
          failedCount: 0,
          errorMessage: 'Device is offline'
        };
      }

      // Step 1: Sync from local to server
      console.log('Starting local to server sync');
      const localToServerResult = await this.syncFromLocalToServer(projectId);
      console.log('Local to server result:', localToServerResult);

      // Step 2: Sync from server to local
      console.log('Starting server to local sync');
      const serverToLocalSynced = await this.syncFromServerToLocal(projectId);
      console.log('Server to local synced count:', serverToLocalSynced);

      const result = {
        success: localToServerResult.success,
        syncedCount: localToServerResult.syncedCount + serverToLocalSynced,
        failedCount: localToServerResult.failedCount,
        errorMessage: localToServerResult.errorMessage
      };

      console.log('=== Completed syncProject ===');
      console.log('Final result:', result);

      await syncLogger.logSyncOperation('sync_complete', projectId, {
        result
      });

      return result;
    } catch (error) {
      console.error('Error in syncProject:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await syncLogger.logSyncOperation('sync_error', projectId, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errorMessage
      };
    }
  }

  /**
   * Cleanup when the service is no longer needed
   */
  cleanup() {
    this.stop();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  private async handleDeletedFeature(projectId: number, clientId: string): Promise<void> {
    console.log('Handling deleted feature:', clientId);
    try {
      // Get existing features
      const existingFeatures = await featureStorageService.getUnsyncedFeatures(projectId);
      
      // Filter out the deleted feature
      const updatedFeatures = existingFeatures.filter((f: any) => f.client_id !== clientId);
      
      // Save the updated features
      if (updatedFeatures.length < existingFeatures.length) {
        const firstFeature = updatedFeatures[0];
        const firstPoint = firstFeature.points[0];
        
        const pointToSave: PointCollected = {
          client_id: firstFeature.client_id,
          name: firstFeature.name,
          description: firstPoint?.description || '',
          draw_layer: firstFeature.draw_layer,
          attributes: firstPoint?.attributes || {},
          created_by: firstFeature.created_by?.toString() || '',
          created_at: firstFeature.created_at,
          updated_at: firstFeature.updated_at,
          updated_by: firstFeature.updated_by?.toString() || '',
          synced: false,
          feature_id: 0,
          project_id: projectId
        };
        await featureStorageService.savePoint(pointToSave);
      }
    } catch (error) {
      console.error('Error handling deleted feature:', error);
      throw error;
    }
  }
}

export const syncService = new SyncService(); 