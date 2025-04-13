import { api } from '@/api/clients';
import { API_ENDPOINTS } from '@/api/endpoints';
import { storageService } from '../storage/storageService';
import NetInfo from '@react-native-community/netinfo';
import { PointCollected } from '@/types/pointCollected.types';
import { AxiosError } from 'axios';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';


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
 * Formats a stored point for API submission
 * @param point - The point to format
 * @returns Formatted point data for API or null if coordinates are missing
 */
const formatPointForAPI = (point: PointCollected): FormattedPoint | null => {
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
      type: 'Point', // Default to Point type
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
      attributes: {} // Empty attributes object for future use
    }
  };
};

// Helper function to build endpoint URL
const buildEndpoint = (endpoint: string, params: Record<string, string | number>): string => {
  console.log('buildEndpoint called with:', { endpoint, params });
  if (!endpoint) {
    console.error('buildEndpoint received undefined endpoint');
    return '';
  }
  const result = Object.entries(params).reduce(
    (url, [key, value]) => url.replace(`:${key}`, value.toString()),
    endpoint.replace(/^\//, '')
  );
  console.log('buildEndpoint result:', result);
  return result;
};

/**
 * Service for syncing collected points with the server
 */
class SyncService {
  /**
   * Checks if the device is online
   * @returns Promise resolving to boolean indicating online status
   */
  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
  }
  
  /**
   * Syncs points for a specific project with the server
   * @param projectId - The project ID to sync points for
   * @returns Promise resolving to SyncResult
   */
  async syncPoints(projectId: number): Promise<SyncResult> {
    try {
      console.log('=== Starting syncPoints ===');
      console.log('Project ID:', projectId);
      
      // Verify project ID
      if (!projectId) {
        console.log('Sync failed: No project ID provided');
        return {
          success: false,
          syncedCount: 0,
          failedCount: 0,
          errorMessage: 'No project ID provided'
        };
      }
      
      // Check if online
      const online = await this.isOnline();
      console.log('Online status:', online);
      if (!online) {
        console.log('Sync failed: Device is offline');
        return { 
          success: false, 
          syncedCount: 0, 
          failedCount: 0,
          errorMessage: 'Device is offline' 
        };
      }
      
      // Get unsynced points for this project
      const unsyncedPoints = await storageService.getUnsyncedPointsForProject(projectId);
      console.log('Unsynced points found:', unsyncedPoints.length);
      console.log('Unsynced points:', JSON.stringify(unsyncedPoints, null, 2));
      
      if (unsyncedPoints.length === 0) {
        console.log('No points to sync');
        return { 
          success: true, 
          syncedCount: 0, 
          failedCount: 0 
        };
      }
      
      // Format points for API
      const formattedPoints = unsyncedPoints
        .map(formatPointForAPI)
        .filter((point): point is FormattedPoint => point !== null);
      
      console.log('Formatted points for API:', JSON.stringify(formattedPoints, null, 2));
      
      if (formattedPoints.length === 0) {
        console.log('No valid points to sync after filtering');
        return { 
          success: true, 
          syncedCount: 0, 
          failedCount: 0 
        };
      }
      
      // Construct the endpoint URL with the project ID
      const endpoint = buildEndpoint(API_ENDPOINTS.SYNC_COLLECTED_FEATURES, { projectId });
      console.log('Sync endpoint:', endpoint);
      
      // Send points to server
      console.log('Sending points to server...');
      const response = await api.post(endpoint, { 
        features: formattedPoints,
        lastSyncTimestamp: null // We'll implement this later for bi-directional sync
      });
      console.log('Server response:', JSON.stringify(response.data, null, 2));
      
      if (response.data && response.data.success) {
        const syncedIds = response.data.processed || [];
        const failedIds = response.data.failed || [];
        
        console.log('Synced IDs:', syncedIds);
        console.log('Failed IDs:', failedIds);
        
        // Mark as synced in local storage  
        if (syncedIds.length > 0) {
          console.log('Marking points as synced in local storage...');
          await storageService.markPointsAsSynced(syncedIds);
          console.log('Points marked as synced successfully');
        }
        
        console.log('=== Sync completed successfully ===');
        return {
          success: true,
          syncedCount: syncedIds.length,
          failedCount: failedIds.length
        };
      } else {
        console.log('Sync failed:', response.data?.message || 'Unknown error');
        return {
          success: false,
          syncedCount: 0,
          failedCount: unsyncedPoints.length,
          errorMessage: response.data?.message || 'Sync failed'
        };
      }
    } catch (error) {
      console.error('Sync error:', error);
      // Handle Axios errors specifically
      if (error instanceof AxiosError) {
        let errorMessage = 'Unknown API error';
        
        if (error.response) {
          // The request was made and the server responded with a status code
          errorMessage = `Server returned ${error.response.status}: ${error.response.data?.error || 'No error details'}`;
        } else if (error.request) {
          // The request was made but no response was received
          errorMessage = 'No response received from server';
        } else {
          // Something happened in setting up the request
          errorMessage = error.message || 'Error setting up request';
        }
        
        return {
          success: false,
          syncedCount: 0,
          failedCount: 0,
          errorMessage
        };
      }
      
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Syncs all points across all projects
   * @returns Promise resolving to SyncResult
   */
  async syncAllPoints(): Promise<SyncResult> {
    try {
      // Check if online
      const online = await this.isOnline();
      if (!online) {
        return { 
          success: false, 
          syncedCount: 0,
          failedCount: 0,
          errorMessage: 'Device is offline' 
        };
      }
      
      // Get all unsynced points
      const unsyncedPoints = await storageService.getUnsyncedPoints();
      if (unsyncedPoints.length === 0) {
        return { success: true, syncedCount: 0, failedCount: 0 };
      }
      
      // Group points by projectId
      const pointsByProject: Record<number, PointCollected[]> = {};
      
      unsyncedPoints.forEach((point: PointCollected) => {
        const projectId = point.project_id;
        
        if (!pointsByProject[projectId]) {
          pointsByProject[projectId] = [];
        }
        
        pointsByProject[projectId].push(point);
      });
      
      // Track results
      let totalSynced = 0;
      let totalFailed = 0;
      let lastError = '';
      
      // Sync points for each project
      const projectIds = Object.keys(pointsByProject).map(Number);
      
      for (const projectId of projectIds) {
        try {
          const result = await this.syncPoints(projectId);
          
          if (result.success) {
            totalSynced += result.syncedCount;
          } else {
            totalFailed += pointsByProject[projectId].length;
            lastError = result.errorMessage || 'Unknown error';
          }
        } catch (error) {
          totalFailed += pointsByProject[projectId].length;
          lastError = error instanceof Error ? error.message : 'Unknown error';
        }
      }
      
      return {
        success: totalFailed === 0,
        syncedCount: totalSynced,
        failedCount: totalFailed,
        errorMessage: totalFailed > 0 ? lastError : undefined
      };
    } catch (error) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const syncService = new SyncService(); 