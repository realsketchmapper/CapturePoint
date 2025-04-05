import { api } from '@/src/api/clients';
import { API_ENDPOINTS } from '@/src/api/endpoints';
import { storageService } from './storageService';
import NetInfo from '@react-native-community/netinfo';
import { PointCollected } from '@/src/types/pointCollected.types';
import { AxiosError } from 'axios';

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
  client_id: string;
  category: number;
  type: string;
  name?: string;
  description?: string;
  project_id: number;
  coords: [number, number];
  created_by?: string;
  created_at: string;
  properties?: Record<string, any>;
  nmea_data: {
    gga: any;
    gst: any;
  };
}

/**
 * Formats a stored point for API submission
 * @param point - The point to format
 * @returns Formatted point data for API
 */
const formatPointForAPI = (point: PointCollected): FormattedPoint => {
  // Extract coordinates from NMEA data
  const longitude = point.nmeaData?.gga?.longitude || 0;
  const latitude = point.nmeaData?.gga?.latitude || 0;
  
  return {
    client_id: String(point.id),
    category: point.feature_id,
    type: 'Point', // Default to Point type
    name: point.name,
    description: point.description,
    project_id: point.projectId,
    coords: [longitude, latitude],
    created_by: point.created_by,
    created_at: point.created_at,
    properties: point.attributes,
    nmea_data: {
      gga: point.nmeaData.gga,
      gst: point.nmeaData.gst
    }
  };
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
      // Verify project ID
      if (!projectId) {
        return {
          success: false,
          syncedCount: 0,
          failedCount: 0,
          errorMessage: 'No project ID provided'
        };
      }
      
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
      
      // Get unsynced points for this project
      const unsyncedPoints = await storageService.getUnsyncedPointsForProject(projectId);
      
      if (unsyncedPoints.length === 0) {
        return { 
          success: true, 
          syncedCount: 0, 
          failedCount: 0 
        };
      }
      
      // Format points for API
      const formattedPoints = unsyncedPoints.map(formatPointForAPI);
      
      // Construct the endpoint URL with the project ID
      const endpoint = API_ENDPOINTS.SYNC_POINTS.replace(':projectId', projectId.toString());
      
      // Send points to server
      const response = await api.post(endpoint, { points: formattedPoints });
      
      if (response.data && response.data.success) {
        const syncedIds = response.data.syncedIds || 
                         response.data.created_ids || 
                         unsyncedPoints.map((p: PointCollected) => p.id);
        
        // Mark as synced in local storage
        if (syncedIds.length > 0) {
          await storageService.markPointsAsSynced(syncedIds);
        }
        
        return {
          success: true,
          syncedCount: syncedIds.length,
          failedCount: 0
        };
      } else {
        return {
          success: false,
          syncedCount: 0,
          failedCount: unsyncedPoints.length,
          errorMessage: response.data?.error || 'Sync failed'
        };
      }
    } catch (error) {
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
        const projectId = point.projectId;
        
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