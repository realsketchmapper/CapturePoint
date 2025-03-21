// services/sync/syncService.ts
import { api } from "@/api/clients";
import { API_ENDPOINTS } from "@/api/endpoints";
import { storageService } from '../storage/storageService';
import NetInfo from '@react-native-community/netinfo';
import { PointCollected } from "@/types/pointCollected.types";
import { GGAData, GSTData } from "@/types/nmea.types";
import { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/storage';
import { AppState, AppStateStatus } from 'react-native';

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
}

// Helper to format a stored point for the API
const formatPointForAPI = (point: PointCollected) => {
  // Debug log the full point data
  console.log("🔍 Input point data:", JSON.stringify(point, null, 2));
  
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
      }
    }
    
    console.log(`🔍 Extracted coordinates: lon=${longitude}, lat=${latitude}`);
    
    // Validate coordinates
    if (!isFinite(longitude) || !isFinite(latitude)) {
      throw new Error(`Invalid coordinates: lon=${longitude}, lat=${latitude}`);
    }
    if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
      throw new Error(`Coordinates out of range: lon=${longitude}, lat=${latitude}`);
    }
  } catch (error) {
    console.error("❌ Error extracting coordinates:", error);
    // Always have a fallback to NMEA data which seems reliable
    longitude = point.nmeaData?.gga?.longitude || 0;
    latitude = point.nmeaData?.gga?.latitude || 0;
  }
  
  // Format point for API - send as [latitude, longitude] for MySQL's ST_GeomFromText
  const formattedPoint = {
    client_id: point.id,
    category: point.featureTypeId,
    type: point.featureType,
    name: point.name,
    project_id: point.projectId,
    coords: [latitude, longitude], // Send as [latitude, longitude] for MySQL's ST_GeomFromText
    created_by: point.properties?.userId || 1,
    created_at: point.created_at,
    attributes: {
      description: point.attributes?.description || ''  // Keep description in attributes for CollectedPoints
    },
    properties: {
      name: point.name,
      featureType: point.featureType,
      draw_layer: point.properties?.draw_layer,
      pointId: point.id,
      featureName: point.properties?.featureName,
      userId: point.properties?.userId || 1,
      deviceInfo: point.properties?.deviceInfo
    },
    nmea_data: point.nmeaData
  };
  
  console.log('🔍 Validating formatted point...');
  console.log('✅ Formatted point for API:', JSON.stringify(formattedPoint, null, 2));
  
  return formattedPoint;
};

// Add type definition for server point
interface ServerPoint {
  client_id: string;
  type: string;
  category: number;
  name: string;
  project_id: number;
  coords: [number, number];
  created_by: number;
  created_at: string;
  updated_at?: string;
  attributes?: {
    description?: string;
    [key: string]: any;
  };
  properties?: {
    [key: string]: any;
  };
  nmea_data?: {
    gga?: GGAData;
    gst?: GSTData;
  };
}

// Helper to convert server point to local format
const convertServerPointToLocal = (serverPoint: ServerPoint): PointCollected => {
  console.log('Converting server point to local format:', {
    client_id: serverPoint.client_id,
    type: serverPoint.type,
    category: serverPoint.category
  });

  // Convert NMEA data to expected format with all required fields
  const nmeaData = {
    gga: {
      time: serverPoint.nmea_data?.gga?.time || '',
      latitude: serverPoint.nmea_data?.gga?.latitude || null,
      longitude: serverPoint.nmea_data?.gga?.longitude || null,
      quality: serverPoint.nmea_data?.gga?.quality || 0,
      satellites: serverPoint.nmea_data?.gga?.satellites || 0,
      hdop: serverPoint.nmea_data?.gga?.hdop || 0,
      altitude: serverPoint.nmea_data?.gga?.altitude || 0,
      altitudeUnit: serverPoint.nmea_data?.gga?.altitudeUnit || 'm',
      geoidHeight: serverPoint.nmea_data?.gga?.geoidHeight || 0,
      geoidHeightUnit: serverPoint.nmea_data?.gga?.geoidHeightUnit || 'm'
    },
    gst: {
      time: serverPoint.nmea_data?.gst?.time || '',
      rmsTotal: serverPoint.nmea_data?.gst?.rmsTotal || 0,
      semiMajor: serverPoint.nmea_data?.gst?.semiMajor || 0,
      semiMinor: serverPoint.nmea_data?.gst?.semiMinor || 0,
      orientation: serverPoint.nmea_data?.gst?.orientation || 0,
      latitudeError: serverPoint.nmea_data?.gst?.latitudeError || 0,
      longitudeError: serverPoint.nmea_data?.gst?.longitudeError || 0,
      heightError: serverPoint.nmea_data?.gst?.heightError || 0
    }
  };

  return {
    id: serverPoint.client_id,
    name: serverPoint.name || '',
    featureType: serverPoint.type,
    created_at: serverPoint.created_at,
    projectId: serverPoint.project_id,
    featureTypeId: serverPoint.category,
    coordinates: [serverPoint.coords[1], serverPoint.coords[0]], // Convert from [lat,lng] to [lng,lat] for MapLibre
    nmeaData,
    synced: true,
    properties: serverPoint.properties || {},
    attributes: {
      description: serverPoint.attributes?.description || ''  // Get description from server point attributes
    }
  };
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
      console.log('App has come to foreground, triggering sync');
      await this.syncAllProjects();
    }
    this.appState = nextAppState;
  };

  private handleNetworkChange = async (state: any) => {
    if (state.isConnected && !this.isCurrentlySyncing) {
      console.log('Network connection restored, triggering sync');
      await this.syncAllProjects();
    }
  };

  private startPeriodicSync = () => {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    // Sync every 5 minutes
    this.syncInterval = setInterval(async () => {
      if (!this.isCurrentlySyncing) {
        await this.syncAllProjects();
      }
    }, 5 * 60 * 1000);
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
    console.log('\n=== Starting bi-directional sync process ===');
    console.log(`Project ID: ${projectId}`);
    
    try {
      // Get auth token
      console.log('🔑 Checking authentication...');
      const credentialsJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_CREDENTIALS);
      if (!credentialsJson) {
        console.error('❌ No stored credentials found');
        return {
          success: false,
          syncedCount: 0,
          failedCount: 0,
          errorMessage: 'No stored credentials found'
        };
      }

      const credentials = JSON.parse(credentialsJson);
      const token = credentials.token;
      if (!token) {
        console.error('❌ No auth token found in stored credentials');
        return {
          success: false,
          syncedCount: 0,
          failedCount: 0,
          errorMessage: 'No auth token found'
        };
      }
      console.log('✅ Authentication valid');

      // Step 1: Get last sync timestamp for this project
      const lastSync = await AsyncStorage.getItem(`${STORAGE_KEYS.LAST_SYNC_TIME}_${projectId}`);
      console.log(`📅 Last sync time for project ${projectId}:`, lastSync || 'Never synced');

      // Step 2: Get unsynced local points
      const unsyncedPoints = await storageService.getUnsyncedPointsForProject(projectId);
      console.log(`📤 Found ${unsyncedPoints.length} local unsynced points`);
      if (unsyncedPoints.length > 0) {
        console.log('First unsynced point:', {
          id: unsyncedPoints[0].id,
          type: unsyncedPoints[0].featureType,
          coords: unsyncedPoints[0].coordinates
        });
      }

      // Step 3: Format points for API
      console.log('🔄 Formatting points for API...');
      const formattedPoints = unsyncedPoints.map(formatPointForAPI);

      // Step 4: Make bi-directional sync API call
      console.log(`🌐 Making bi-directional sync call to: /${projectId}/sync-points`);
      const requestPayload = { 
        points: formattedPoints,
        last_sync: lastSync || null
      };
      console.log('Full request payload:', JSON.stringify(requestPayload, null, 2));

      try {
        const response = await api.post(
          API_ENDPOINTS.SYNC_POINTS.replace(':projectId', projectId.toString()),
          requestPayload
        );

        let data = response.data;
        console.log('📥 API response status:', response.status);
        console.log('Full response data:', JSON.stringify(data, null, 2));

        // Add validation for the response
        if (!data.syncedIds && formattedPoints.length > 0) {
          console.warn('⚠️ Server returned success but no syncedIds for sent points:', {
            pointsSent: formattedPoints.length,
            responseStatus: response.status,
            serverSuccess: data.success
          });
          
          // Log request details for debugging
          console.log('🔍 Debug - Request URL:', response.config.url);
          console.log('🔍 Debug - Request headers:', {
            ...response.config.headers,
            'Authorization': 'Bearer [hidden]'
          });
          console.log('🔍 Debug - Response headers:', response.headers);
        }

        if (data.success) {
          // Step 5: Process server response
          const { syncedIds, serverPoints, serverTime } = data;
          
          // Track sync counts
          let pushCount = 0;
          let pullCount = 0;
          let mergeCount = 0;
          
          // Mark local points as synced
          if (syncedIds?.length > 0) {
            console.log(`✅ Marking ${syncedIds.length} points as synced:`, syncedIds);
            await storageService.markPointsAsSynced(syncedIds, projectId);
            pushCount = syncedIds.length;
          }

          // Process points from server
          if (serverPoints?.length > 0) {
            console.log(`📥 Processing ${serverPoints.length} points from server`);
            for (const serverPoint of serverPoints) {
              try {
                console.log(`Processing server point ${serverPoint.client_id}`);
                
                // Convert server point to local format
                const localPoint = convertServerPointToLocal(serverPoint);
                
                // Check if point exists locally
                const existingPoint = await storageService.getPointById(serverPoint.client_id);
                
                if (existingPoint) {
                  // Update existing point if server version is newer
                  const serverUpdated = new Date(serverPoint.updated_at || serverPoint.created_at);
                  const localUpdated = new Date(existingPoint.updated_at || existingPoint.created_at);
                  
                  console.log('Comparing timestamps:', {
                    pointId: serverPoint.client_id,
                    serverTime: serverUpdated.toISOString(),
                    localTime: localUpdated.toISOString()
                  });

                  if (serverUpdated > localUpdated) {
                    console.log(`🔄 Updating existing point ${serverPoint.client_id} with newer server version`);
                    await storageService.updatePoint(serverPoint.client_id, localPoint);
                    mergeCount++;
                  } else {
                    console.log(`🔄 Skipping point ${serverPoint.client_id} as local version is newer`);
                  }
                } else {
                  console.log(`🔄 Adding new point ${serverPoint.client_id} to local storage`);
                  await storageService.addPoint(localPoint);
                  pullCount++;
                }
              } catch (error) {
                console.error(`❌ Error processing server point ${serverPoint.client_id}:`, error);
              }
            }
          }

          return {
            success: true,
            syncedCount: pushCount + pullCount + mergeCount,  // Total count of all sync operations
            failedCount: 0,
            pullCount,
            pushCount,
            mergeCount,
            lastServerSync: serverTime
          };
        } else {
          console.error('❌ Server returned failure:', data);
          return {
            success: false,
            syncedCount: 0,
            failedCount: 0,
            errorMessage: data.errorMessage || 'Server returned failure'
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
  },
};