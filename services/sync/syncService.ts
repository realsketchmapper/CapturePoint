// services/sync/syncService.ts
import { api } from "@/api/clients";
import { API_ENDPOINTS } from "@/api/endpoints";
import { storageService } from '../storage/storageService';
import NetInfo from '@react-native-community/netinfo';
import { PointCollected, CollectedFeature } from "@/types/pointCollected.types";
import { UtilityFeatureType } from "@/types/features.types";
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
}

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
    
    // Sync every 15 minutes instead of 5
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

      for (const projectId of activeProjects) {
        const result = await syncService.syncPoints(projectId);
        if (result.success) {
          totalSynced += result.syncedCount;
        } else {
          totalFailed += result.failedCount;
          lastError = result.errorMessage || 'Unknown error';
        }
      }

      return {
        success: totalFailed === 0,
        syncedCount: totalSynced,
        failedCount: totalFailed,
        errorMessage: totalFailed > 0 ? lastError : undefined
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
  
  // Sync points with the server for a specific project
  syncPoints: async (projectId: number): Promise<SyncResult> => {
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

      // Get unsynced features from storage
      const unsyncedFeatures = await storageService.getUnsyncedFeatures(projectId);
      console.log(`Found ${unsyncedFeatures.length} unsynced features`);

      // Get feature types for this project
      const featureTypes = await storageService.getFeatureTypes(projectId);
      const featureTypeMap = new Map(featureTypes.map(ft => [ft.id, ft]));

      // Prepare data for sync
      const syncData = unsyncedFeatures.map(feature => ({
        id: feature.id,
        client_id: feature.client_id,
        featureTypeId: feature.featureTypeId,
        project_id: feature.project_id,
        attributes: feature.attributes,
        is_active: feature.is_active,
        points: feature.points.map(point => ({
          id: point.id,
          client_id: point.client_id,
          fcode: point.fcode,
          coords: point.coordinates,
          attributes: point.attributes,
          is_active: point.is_active
        }))
      }));

      // Send data to server
      const endpoint = API_ENDPOINTS.SYNC_POINTS.replace(':projectId', projectId.toString());
      const response = await api.post(endpoint, { features: syncData });

      if (response.data.success) {
        const serverFeatures = response.data.features as ServerFeature[];
        console.log(`Received ${serverFeatures.length} features from server`);

        // Process server features
        for (const serverFeature of serverFeatures) {
          const featureType = featureTypeMap.get(serverFeature.featureTypeId);
          if (!featureType) {
            console.warn(`No feature type found for ID ${serverFeature.featureTypeId}`);
            continue;
          }

          const localFeature = convertServerFeature(serverFeature, featureType);
          await storageService.saveFeature(localFeature);
        }

        // Update last sync time
        const serverTime = response.data.serverTime || new Date().toISOString();
        await AsyncStorage.setItem(
          `${STORAGE_KEYS.LAST_SYNC_TIME}_${projectId}`,
          serverTime
        );

        // Update unsynced count
        const remainingUnsynced = await storageService.getUnsyncedFeatures(projectId);
        await AsyncStorage.setItem(
          `${STORAGE_KEYS.UNSYNCED_COUNT}_${projectId}`,
          remainingUnsynced.length.toString()
        );

        return {
          success: true,
          syncedCount: serverFeatures.length,
          failedCount: 0,
          remainingUnsyncedCount: remainingUnsynced.length,
          lastServerSync: serverTime
        };
      }

      return {
        success: false,
        syncedCount: 0,
        failedCount: unsyncedFeatures.length,
        errorMessage: response.data.error || 'Unknown error'
      };
    } catch (error) {
      console.error('Error in syncPoints:', error);
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  // Convert server feature type to local format
  convertServerFeatureType: (serverFeatureType: ServerFeatureType): UtilityFeatureType => {
    return {
      id: serverFeatureType.id,
      name: serverFeatureType.name,
      category: serverFeatureType.category,
      geometryType: serverFeatureType.geometryType,
      image_url: serverFeatureType.image_url,
      svg: serverFeatureType.svg,
      color: serverFeatureType.color,
      line_weight: serverFeatureType.line_weight,
      dash_pattern: serverFeatureType.dash_pattern,
      z_value: serverFeatureType.z_value,
      draw_layer: serverFeatureType.draw_layer,
      is_active: serverFeatureType.is_active,
      attributes: serverFeatureType.attributes
    };
  },

  // Convert server feature to local format
  convertServerFeature: (serverFeature: ServerFeature, featureType: UtilityFeatureType): CollectedFeature => {
    const points: ServerPoint[] = serverFeature.points || [];
    const convertedPoints = points.map(point => ({
      id: point.id,
      client_id: point.client_id,
      fcode: point.fcode,
      coordinates: point.coords,
      attributes: {
        featureTypeId: serverFeature.featureTypeId,  // Required field first
        ...point.attributes  // Additional attributes after
      },
      project_id: serverFeature.project_id,
      feature_id: serverFeature.id,
      is_active: point.is_active,
      created_by: point.created_by,
      created_at: point.created_at,
      updated_by: point.updated_by,
      updated_at: point.updated_at
    }));

    return {
      id: serverFeature.id,
      client_id: serverFeature.client_id,
      featureTypeId: serverFeature.featureTypeId,
      featureType: featureType,
      project_id: serverFeature.project_id,
      points: convertedPoints,
      attributes: serverFeature.attributes,
      is_active: serverFeature.is_active,
      created_by: serverFeature.created_by,
      created_at: serverFeature.created_at,
      updated_by: serverFeature.updated_by,
      updated_at: serverFeature.updated_at
    };
  }
};