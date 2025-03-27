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

// Helper to format a stored point for the API
const formatPointForAPI = (point: PointCollected) => {
  // Debug log the full point data
  console.log('Formatting point for API:', JSON.stringify(point, null, 2));
  
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
  
  console.log('Formatted point for API:', JSON.stringify(apiPoint, null, 2));
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

      // Format points for API
      const formattedPoints = unsyncedPoints.map(point => ({
        id: point.id,
        client_id: point.client_id,
        fcode: point.fcode,
        coords: point.coordinates,
        attributes: {
          ...point.attributes,
          category: point.attributes.category || '',
          type: point.attributes.type || '',
          name: point.attributes.name || '',
          properties: point.attributes.properties || {},
          description: point.attributes.description || '',
          nmea_data: point.attributes.nmeaData || null
        },
        project_id: point.project_id,
        feature_id: point.feature_id,
        is_active: point.is_active,
        created_by: point.created_by,
        created_at: point.created_at,
        updated_by: point.updated_by,
        updated_at: point.updated_at
      }));

      // Send points to server
      const endpoint = API_ENDPOINTS.SYNC_POINTS.replace(':projectId', projectId.toString());
      const response = await api.post(endpoint, { points: formattedPoints });

      if (response.data.success) {
        // Mark points as synced
        await storageService.markPointsAsSynced(
          response.data.syncedIds || [],
          projectId
        );

        return {
          success: true,
          syncedCount: response.data.syncedIds ? response.data.syncedIds.length : 0,
          failedCount: response.data.created_ids ? response.data.created_ids.length : 0,
          errorMessage: response.data.error ? response.data.error : undefined
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