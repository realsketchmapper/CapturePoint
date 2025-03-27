// services/sync/syncService.ts
import { api } from "@/api/clients";
import { API_ENDPOINTS } from "@/api/endpoints";
import { storageService } from '../storage/storageService';
import NetInfo from '@react-native-community/netinfo';
import { PointCollected } from "@/types/pointCollected.types";
import { CollectedFeature } from "@/types/features.types";
import { FeatureType } from "@/types/features.types";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/storage';
import { AppState, AppStateStatus } from 'react-native';
import { generateClientId } from '@/utils/collections';
import { ServerFeature, ServerFeatureType, ServerPoint } from "@/types/server.types";
import { convertServerFeature, convertServerFeatureType } from "@/utils/featureConversion";

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errorMessage?: string;
  // New fields for bi-directional sync
  pullCount?: number;  // Number of records pulled from server
  pushCount?: number;  // Number of records pushed to server
  mergeCount?: number; // Number of records that required merging
  lastServerSync?: string; // Server's last sync timestamp
  remainingUnsyncedCount?: number; // Number of remaining unsynced features
  featureUpdates?: number; // Number of features updated
}

// Helper to format a stored point for the API
const formatPointForAPI = (point: PointCollected) => {
  // Extract coordinates from NMEA data if available
  let coordinates = point.coordinates;
  if (point.attributes?.nmeaData?.gga) {
    const gga = point.attributes.nmeaData.gga;
    if (typeof gga.longitude === 'number' && typeof gga.latitude === 'number') {
      coordinates = [gga.longitude, gga.latitude];
    }
  }
  
  // Create the API point object
  const apiPoint = {
    id: point.id,
    client_id: point.client_id,
    fcode: point.fcode,
    coords: coordinates,
    attributes: {
      ...point.attributes,
      nmeaData: point.attributes?.nmeaData || null
    },
    project_id: point.project_id,
    feature_id: point.feature_id,
    is_active: point.is_active,
    created_by: point.created_by,
    created_at: point.created_at,
    updated_by: point.updated_by,
    updated_at: point.updated_at
  };
  
  return apiPoint;
};

class SyncManager {
  private syncInterval: NodeJS.Timeout | null = null;
  private isCurrentlySyncing = false;
  private appState: AppStateStatus = AppState.currentState;
  private appStateSubscription: any;

  constructor() {
    // Listen for app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    
    // Listen for network changes
    NetInfo.addEventListener(this.handleNetworkChange);
    
    // Start periodic sync
    this.startPeriodicSync();
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
      // Only sync if we have unsynced changes
      const hasUnsynced = await this.hasUnsyncedChanges();
      if (hasUnsynced) {
        console.log('App has come to foreground and has unsynced changes, triggering sync');
        await this.syncAllProjects();
      }
    }
    this.appState = nextAppState;
  };

  private handleNetworkChange = async (state: any) => {
    if (state.isConnected && !this.isCurrentlySyncing) {
      // Only sync if we have unsynced changes
      const hasUnsynced = await this.hasUnsyncedChanges();
      if (hasUnsynced) {
        console.log('Network connection restored and has unsynced changes, triggering sync');
        await this.syncAllProjects();
      }
    }
  };

  private async hasUnsyncedChanges(): Promise<boolean> {
    try {
      const activeProjects = await storageService.getActiveProjects();
      for (const projectId of activeProjects) {
        const unsyncedFeatures = await storageService.getUnsyncedFeatures(projectId);
        if (unsyncedFeatures.length > 0) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking for unsynced changes:', error);
      return false;
    }
  }

  private startPeriodicSync = () => {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    // Sync every 15 minutes
    this.syncInterval = setInterval(async () => {
      if (!this.isCurrentlySyncing) {
        const hasUnsynced = await this.hasUnsyncedChanges();
        if (hasUnsynced) {
          console.log('Periodic sync found unsynced changes, triggering sync');
          await this.syncAllProjects();
        }
      }
    }, 15 * 60 * 1000); // 15 minutes
  };

  public async syncAllProjects(): Promise<SyncResult> {
    if (this.isCurrentlySyncing) {
      console.log('Sync already in progress, skipping');
      return {
        success: true,
        syncedCount: 0,
        failedCount: 0
      };
    }

    this.isCurrentlySyncing = true;
    try {
      const activeProjects = await storageService.getActiveProjects();
      let totalSynced = 0;
      let totalFailed = 0;
      let lastError = '';
      let featureUpdates = 0;

      for (const projectId of activeProjects) {
        const result = await syncService.syncProject(projectId);
        if (result.success) {
          totalSynced += result.syncedCount;
          featureUpdates += result.featureUpdates || 0;
        } else {
          totalFailed += result.failedCount;
          lastError = result.errorMessage || 'Unknown error';
        }
      }

      return {
        success: totalFailed === 0,
        syncedCount: totalSynced,
        failedCount: totalFailed,
        errorMessage: totalFailed > 0 ? lastError : undefined,
        featureUpdates
      };
    } catch (error) {
      console.error('Error in syncAllProjects:', error);
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.isCurrentlySyncing = false;
    }
  }

  public cleanup() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.appStateSubscription.remove();
  }
}

// Create singleton instance
export const syncManager = new SyncManager();

export const syncService = {
  // Check if device is online
  isOnline: async (): Promise<boolean> => {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
  },

  // Sync a single project
  syncProject: async (projectId: number): Promise<SyncResult> => {
    try {
      const credentialsJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_CREDENTIALS);
      if (!credentialsJson) {
        return {
          success: false,
          syncedCount: 0,
          failedCount: 0,
          errorMessage: 'No stored credentials found'
        };
      }
      
      // Check if online
      const online = await syncService.isOnline();
      if (!online) {
        console.log("❌ Device is offline");
        return { 
          success: false, 
          syncedCount: 0, 
          failedCount: 0,
          errorMessage: 'Device is offline' 
        };
      }

      // Sync points
      const pointsResult = await syncService.syncPoints(projectId);
      return pointsResult;
    } catch (error) {
      console.error('Error in syncProject:', error);
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
  
  // Sync points with the server for a specific project
  syncPoints: async (projectId: number): Promise<SyncResult> => {
    try {
      // Get unsynced points for this project
      const unsyncedPoints = await storageService.getUnsyncedPointsForProject(projectId);
      console.log(`Found ${unsyncedPoints.length} unsynced points`);

      if (unsyncedPoints.length === 0) {
        console.log('No unsynced points to sync');
        return {
          success: true,
          syncedCount: 0,
          failedCount: 0
        };
      }

      // Format points for sync
      const formattedPoints = unsyncedPoints.map(point => ({
        client_id: point.client_id,
        fcode: point.fcode,
        coords: point.coordinates,
        attributes: point.attributes,
        project_id: point.project_id,
        feature_id: point.feature_id,
        is_active: point.is_active,
        created_by: point.created_by,
        created_at: point.created_at,
        updated_by: point.updated_by,
        updated_at: point.updated_at
      }));

      // Group points by feature
      const features = unsyncedPoints.reduce((acc, point) => {
        const featureId = point.attributes?.featureTypeId || 0;
        if (!acc[featureId]) {
          acc[featureId] = {
            client_id: `feature_${point.client_id}`,
            category: point.attributes?.category || '',
            type: point.attributes?.type || 'Point',
            name: point.attributes?.name || '',
            project_id: projectId,
            attributes: point.attributes || {},
            points: []
          };
        }
        acc[featureId].points.push(formattedPoints.find(p => p.client_id === point.client_id));
        return acc;
      }, {} as Record<number, any>);

      const requestPayload = {
        features: Object.values(features),
        last_sync: await storageService.getLastSyncTime(projectId)
      };

      // Send points to server
      const endpoint = `${API_ENDPOINTS.BASE_URL}${API_ENDPOINTS.SYNC_POINTS.replace(':projectId', projectId.toString())}`;
      console.log('Syncing points to endpoint:', endpoint);
      console.log('Request payload:', requestPayload);
      
      try {
        const response = await api.post(endpoint, requestPayload);
        console.log('API Response:', response.data);

        if (response.data.success) {
          // Mark points as synced
          await storageService.markPointsAsSynced(
            response.data.syncedIds || [],
            projectId
          );

          // Handle server points if any were returned
          if (response.data.serverPoints) {
            const serverPoints = response.data.serverPoints;
            let featureUpdates = 0;

            console.log(`Processing ${serverPoints.length} server points`);

            for (const serverPoint of serverPoints) {
              // Get the feature type for this point
              const featureType = await storageService.getFeatureType(
                serverPoint.attributes.featureTypeId,
                projectId
              );

              if (!featureType) {
                console.error(`Feature type not found for point ${serverPoint.client_id}`);
                continue;
              }

              // Convert and save the point
              const point: PointCollected = {
                id: serverPoint.id,
                client_id: serverPoint.client_id,
                fcode: serverPoint.fcode,
                coordinates: serverPoint.coords,
                attributes: {
                  ...serverPoint.attributes,
                  featureTypeId: featureType.id
                },
                project_id: projectId,
                feature_id: serverPoint.feature_id,
                is_active: serverPoint.is_active,
                created_by: serverPoint.created_by,
                created_at: serverPoint.created_at,
                updated_by: serverPoint.updated_by,
                updated_at: serverPoint.updated_at
              };

              await storageService.savePoint(point);
              featureUpdates++;
            }

            return {
              success: true,
              syncedCount: response.data.syncedIds ? response.data.syncedIds.length : 0,
              failedCount: response.data.created_ids ? response.data.created_ids.length : 0,
              errorMessage: response.data.error ? response.data.error : undefined,
              lastServerSync: response.data.serverTime,
              featureUpdates
            };
          }

          return {
            success: true,
            syncedCount: response.data.syncedIds ? response.data.syncedIds.length : 0,
            failedCount: response.data.created_ids ? response.data.created_ids.length : 0,
            errorMessage: response.data.error ? response.data.error : undefined,
            lastServerSync: response.data.serverTime
          };
        } else {
          console.error('Error in syncPoints:', response.data.error);
          return {
            success: false,
            syncedCount: 0,
            failedCount: response.data.created_ids ? response.data.created_ids.length : 0,
            errorMessage: response.data.error ? response.data.error : 'Unknown error'
          };
        }
      } catch (error) {
        console.error('Error in syncPoints:', error);
        return {
          success: false,
          syncedCount: 0,
          failedCount: 0,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    } catch (error) {
      console.error('Error in syncPoints:', error);
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};