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

<<<<<<< HEAD
// Helper to format a stored point for the API
const formatPointForAPI = (point: PointCollected) => {
  // Debug log the full point data
  console.log("Formatting point for API");
  
  // Extract coordinates properly based on feature type
  let longitude, latitude;
  
  try {
    // For Point features - handle nested coordinate arrays correctly
    if (point.featureType === 'Point') {
      if (Array.isArray(point.coordinates)) {
        if (Array.isArray(point.coordinates[0])) {
          // Format [[-86.28, 39.76]]
          longitude = Number(point.coordinates[0][0]);
          latitude = Number(point.coordinates[0][1]);
        } else {
          // Format [-86.28, 39.76]
          longitude = Number(point.coordinates[0]);
          latitude = Number(point.coordinates[1]);
        }
      } else {
        // Fallback to NMEA
        longitude = point.nmeaData?.gga?.longitude || 0;
        latitude = point.nmeaData?.gga?.latitude || 0;
      }
    } else {
      // For Line/Polygon features - get first point
      if (Array.isArray(point.coordinates) && Array.isArray(point.coordinates[0])) {
        longitude = Number(point.coordinates[0][0]);
        latitude = Number(point.coordinates[0][1]);
      } else {
        // Fallback to NMEA
        longitude = point.nmeaData?.gga?.longitude || 0;
        latitude = point.nmeaData?.gga?.latitude || 0;
=======
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
>>>>>>> 348a764b70443cc6c7b0062fec508b804d967804
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

<<<<<<< HEAD
  console.log("Point formatted for API");
  return formattedPoint;
};
=======
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
>>>>>>> 348a764b70443cc6c7b0062fec508b804d967804

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
<<<<<<< HEAD
      
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
      
      // Get unsynced points for this project from storageService
      const unsyncedPoints = await storageService.getUnsyncedPointsForProject(projectId);
      console.log(`📊 Found ${unsyncedPoints.length} unsynced points for project ${projectId}`);
      
      if (unsyncedPoints.length === 0) {
        console.log("✅ No points to sync");
        return { 
          success: true, 
          syncedCount: 0, 
          failedCount: 0 
        };
      }
      
      // Format points as expected by the backend
      console.log("🔄 Formatting points for API...");
      const formattedPoints = unsyncedPoints.map(formatPointForAPI);
      
      // Construct the endpoint URL with the project ID
      const endpoint = API_ENDPOINTS.SYNC_POINTS.replace(':projectId', projectId.toString());
      console.log(`🌐 Making API call to: ${endpoint}`);
      
      // Send points to server with explicit error handling
      try {
        // Structure the payload to match server expectations
        const payload = {
          features: formattedPoints.map(point => ({
            client_id: point.client_id,
            category: point.category,
            type: point.type,
            name: point.name,
            project_id: point.project_id,
            attributes: {
              ...point.properties,
              description: point.description
            },
            created_by: point.created_by,
            created_at: point.created_at,
            points: [{
              client_id: point.client_id,
              coords: point.coords,
              attributes: {
                nmea_data: point.nmea_data
              },
              created_by: point.created_by,
              created_at: point.created_at
            }]
          }))
        };
        
        console.log('📦 Request payload sent');
        
        const response = await api.post(endpoint, payload);
        
        console.log('📥 API response received');
        
        if (response.data && response.data.success) {
          const syncedIds = response.data.syncedIds || 
                           response.data.created_ids || 
                           unsyncedPoints.map(p => p.id);
          
          console.log(`✅ Successfully synced ${syncedIds.length} points`);
          
          // Mark as synced in local storage if we have synced IDs
          if (syncedIds && syncedIds.length > 0) {
            await storageService.markPointsAsSynced(syncedIds);
            console.log(`📝 Marked ${syncedIds.length} points as synced in local storage`);
          } else {
            console.log("⚠️ No points were synced, but API returned success");
=======

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
>>>>>>> 348a764b70443cc6c7b0062fec508b804d967804
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