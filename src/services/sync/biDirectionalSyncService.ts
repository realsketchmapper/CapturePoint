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
import { syncLogger } from '../logging/syncLogger';
import { backupService } from '../storage/backupService';

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
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 second
  private readonly MAX_RETRY_DELAY = 30000; // 30 seconds

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
   * Syncs features from the server to local storage for a specific project
   * @param projectId - The project ID to sync features for
   * @returns Promise resolving to the number of features synced from server to local
   */
  async syncFromServerToLocal(projectId: number): Promise<number> {
    return this.executeWithRetry(
      async () => {
        await syncLogger.logSyncOperation('server_to_local_start', projectId, {
          timestamp: new Date().toISOString()
        });

        const activeFeatures = await collectedFeatureService.fetchActiveFeatures(projectId);
        const existingPoints = await storageService.getAllPoints();
        const existingPointMap = new Map(
          existingPoints.map(point => [point.client_id, point])
        );

        const newFeatures: PointCollected[] = [];
        const updatedFeatures: PointCollected[] = [];

        for (const feature of activeFeatures) {
          const firstPoint = feature.properties?.points?.[0];
          const coordinates = firstPoint?.coordinates || [0, 0];
          const [longitude, latitude] = coordinates;

          // Extract NMEA data from the point's attributes
          const nmeaData = firstPoint?.attributes?.nmeaData || {
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
          };

          const pointCollected: PointCollected = {
            client_id: feature.properties?.client_id || generateId(),
            name: feature.featureType?.name || 'Unknown Feature',
            description: feature.featureType?.description || 'No description available',
            draw_layer: feature.data?.draw_layer || feature.featureType?.draw_layer || 'default',
            nmeaData: nmeaData,
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

          const existingPoint = existingPointMap.get(pointCollected.client_id);

          if (!existingPoint) {
            newFeatures.push(pointCollected);
          } else {
            const serverUpdatedAt = new Date(feature.updated_at || '').getTime();
            const localUpdatedAt = new Date(existingPoint.updated_at).getTime();

            if (serverUpdatedAt > localUpdatedAt) {
              updatedFeatures.push(pointCollected);
            }
          }
        }

        // Add new features
        for (const feature of newFeatures) {
          await storageService.savePoint(feature);
        }

        // Update existing features
        for (const feature of updatedFeatures) {
          await storageService.updatePoint(feature);
        }

        const totalSynced = newFeatures.length + updatedFeatures.length;
        await syncLogger.logSyncOperation('server_to_local_complete', projectId, {
          newFeatures: newFeatures.length,
          updatedFeatures: updatedFeatures.length,
          totalSynced
        });

        return totalSynced;
      },
      'syncFromServerToLocal',
      projectId
    );
  }

  /**
   * Performs a complete bi-directional sync for a specific project
   * @param projectId - The project ID to sync
   * @returns Promise resolving to BiDirectionalSyncResult
   */
  async syncProject(projectId: number): Promise<BiDirectionalSyncResult> {
    try {
      await syncLogger.logSyncOperation('sync_start', projectId, {
        timestamp: new Date().toISOString()
      });

      // Check if online
      const online = await this.isOnline();
      if (!online) {
        await syncLogger.logSyncOperation('sync_offline', projectId, {
          error: 'Device is offline'
        });
        return {
          success: false,
          localToServerSynced: 0,
          serverToLocalSynced: 0,
          failedCount: 0,
          errorMessage: 'Device is offline'
        };
      }

      // Create backup before sync
      const points = await storageService.getPointsForProject(projectId);
      await backupService.createBackup(points, projectId);

      // Step 1: Sync from local to server
      const localToServerResult = await this.executeWithRetry(
        () => syncService.syncPoints(projectId),
        'syncPoints',
        projectId
      );

      // Step 2: Sync from server to local
      const serverToLocalSynced = await this.syncFromServerToLocal(projectId);

      // Update last sync timestamp
      await this.updateLastSyncTimestamp();

      const result = {
        success: localToServerResult.success,
        localToServerSynced: localToServerResult.syncedCount,
        serverToLocalSynced,
        failedCount: localToServerResult.failedCount,
        errorMessage: localToServerResult.errorMessage
      };

      await syncLogger.logSyncOperation('sync_complete', projectId, {
        result
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await syncLogger.logSyncOperation('sync_error', projectId, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      // Attempt to restore from backup if sync failed
      try {
        const backups = await backupService.getBackupsForProject(projectId);
        if (backups.length > 0) {
          await backupService.restoreFromBackup(backups[0].timestamp, projectId);
        }
      } catch (restoreError) {
        console.error('Failed to restore from backup:', restoreError);
      }

      return {
        success: false,
        localToServerSynced: 0,
        serverToLocalSynced: 0,
        failedCount: 0,
        errorMessage
      };
    }
  }

  /**
   * Performs a complete bi-directional sync for all projects
   * @returns Promise resolving to BiDirectionalSyncResult
   */
  async syncAllProjects(): Promise<BiDirectionalSyncResult> {
    try {
      await syncLogger.logSyncOperation('sync_all_start', 0, {
        timestamp: new Date().toISOString()
      });

      const online = await this.isOnline();
      if (!online) {
        await syncLogger.logSyncOperation('sync_all_offline', 0, {
          error: 'Device is offline'
        });
        return {
          success: false,
          localToServerSynced: 0,
          serverToLocalSynced: 0,
          failedCount: 0,
          errorMessage: 'Device is offline'
        };
      }

      const localToServerResult = await this.executeWithRetry(
        () => syncService.syncAllPoints(),
        'syncAllPoints',
        0
      );

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

      await this.updateLastSyncTimestamp();

      const result = {
        success: localToServerResult.success,
        localToServerSynced: localToServerResult.syncedCount,
        serverToLocalSynced: totalServerToLocalSynced,
        failedCount: localToServerResult.failedCount,
        errorMessage: localToServerResult.errorMessage
      };

      await syncLogger.logSyncOperation('sync_all_complete', 0, {
        result
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await syncLogger.logSyncOperation('sync_all_error', 0, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        success: false,
        localToServerSynced: 0,
        serverToLocalSynced: 0,
        failedCount: 0,
        errorMessage
      };
    }
  }
}

export const biDirectionalSyncService = new BiDirectionalSyncService(); 