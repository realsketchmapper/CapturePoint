import { api } from '@/api/clients';
import { API_ENDPOINTS } from '@/api/endpoints';
import { featureStorageService } from '../storage/featureStorageService';
import NetInfo from '@react-native-community/netinfo';
import { PointCollected } from '@/types/pointCollected.types';
import { AxiosError } from 'axios';
import { syncLogger } from '../logging/syncLogger';
import { AppState, AppStateStatus } from 'react-native';

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
    const longitude = point.nmeaData?.gga?.longitude;
    const latitude = point.nmeaData?.gga?.latitude;
    
    // Skip points with missing coordinates
    if (longitude === undefined || latitude === undefined || longitude === null || latitude === null) {
      console.warn(`Skipping point ${point.client_id} due to missing coordinates:`, { longitude, latitude });
      return null;
    }
    
    return {
      clientId: String(point.client_id),
      lastModified: point.updated_at,
      data: {
        name: point.name,
        description: point.description,
        category: point.feature_id,
        type: 'Point',
        draw_layer: point.draw_layer,
        points: [{
          client_id: point.client_id,
          coords: [longitude, latitude],
          created_at: point.created_at,
          updated_at: point.updated_at,
          attributes: {
            nmeaData: {
              gga: point.nmeaData.gga,
              gst: point.nmeaData.gst
            }
          }
        }],
        created_at: point.created_at,
        updated_at: point.updated_at,
        attributes: {}
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
    return this.executeWithRetry(
      async () => {
        await syncLogger.logSyncOperation('server_to_local_start', projectId, {
          timestamp: new Date().toISOString()
        });

        const endpoint = API_ENDPOINTS.SYNC_COLLECTED_FEATURES.replace(':projectId', projectId.toString());
        const response = await api.post(endpoint, {
          features: [],
          lastSyncTimestamp: new Date().toISOString()
        });

        if (!response.data.success) {
          throw new Error('Failed to fetch features from server');
        }

        const serverFeatures = response.data.features || [];
        const localFeatures = await featureStorageService.getFeaturesForProject(projectId);
        const localFeatureMap = new Map(
          localFeatures.map(feature => [feature.client_id, feature])
        );

        let syncedCount = 0;

        for (const serverFeature of serverFeatures) {
          const localFeature = localFeatureMap.get(serverFeature.client_id);

          if (!localFeature) {
            // New feature from server
            await featureStorageService.saveLine(serverFeature);
            syncedCount++;
          } else {
            // Update existing feature if server version is newer
            const serverUpdatedAt = new Date(serverFeature.updated_at).getTime();
            const localUpdatedAt = new Date(localFeature.updated_at).getTime();

            if (serverUpdatedAt > localUpdatedAt) {
              await featureStorageService.updateFeature(serverFeature);
              syncedCount++;
            }
          }
        }

        await syncLogger.logSyncOperation('server_to_local_complete', projectId, {
          syncedCount
        });

        return syncedCount;
      },
      'syncFromServerToLocal',
      projectId
    );
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
          timestamp: new Date().toISOString()
        });

        const unsyncedFeatures = await featureStorageService.getUnsyncedFeatures(projectId);
        if (unsyncedFeatures.length === 0) {
          return {
            success: true,
            syncedCount: 0,
            failedCount: 0
          };
        }

        // Format points for API
        const formattedPoints = unsyncedFeatures
          .flatMap(feature => feature.points)
          .map(this.formatPointForAPI)
          .filter((point): point is FormattedPoint => point !== null);

        if (formattedPoints.length === 0) {
          return {
            success: true,
            syncedCount: 0,
            failedCount: 0
          };
        }

        // Send points to server
        const endpoint = API_ENDPOINTS.SYNC_COLLECTED_FEATURES.replace(':projectId', projectId.toString());
        const response = await api.post(endpoint, {
          features: formattedPoints,
          lastSyncTimestamp: new Date().toISOString()
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
            failedCount: formattedPoints.length,
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
          syncedCount: 0,
          failedCount: 0,
          errorMessage: 'Device is offline'
        };
      }

      // Step 1: Sync from local to server
      const localToServerResult = await this.syncFromLocalToServer(projectId);

      // Step 2: Sync from server to local
      const serverToLocalSynced = await this.syncFromServerToLocal(projectId);

      const result = {
        success: localToServerResult.success,
        syncedCount: localToServerResult.syncedCount + serverToLocalSynced,
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
}

export const syncService = new SyncService(); 