// services/sync/syncService.ts
import { api } from "@/api/clients";
import { API_ENDPOINTS } from "@/api/endpoints";
import { storageService } from '../storage/storageService';
import NetInfo from '@react-native-community/netinfo';
import { PointCollected } from "@/types/pointCollected.types";

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errorMessage?: string;
}

// Helper to format a stored point for the API
const formatPointForAPI = (point: PointCollected) => {
  // Debug log the full point data
  console.log("Formatting point for API:", JSON.stringify(point, null, 2));
  
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
    
    console.log(`Extracted coordinates: lon=${longitude}, lat=${latitude}`);
  } catch (error) {
    console.error("Error extracting coordinates:", error);
    // Always have a fallback to NMEA data which seems reliable
    longitude = point.nmeaData?.gga?.longitude || 0;
    latitude = point.nmeaData?.gga?.latitude || 0;
  }
  
  // Return a carefully structured object for the API
  // The field names and structure are critical here
  return {
    // CRITICAL: Make sure client_id is a string and present
    client_id: String(point.id), 
    category: point.featureTypeId,
    type: point.featureType,
    name: point.properties?.name,
    description: point.properties?.description,
    // Include projectId directly as requested by server
    project_id: point.projectId,
    // Coordinates in the format expected
    coords: [longitude, latitude],
    // Individual coordinate components
    //latitude: latitude,
    //longitude: longitude,
    // Include other data from NMEA
    altitude: point.nmeaData?.gga?.altitude,
    error_overall: point.nmeaData?.gst?.rmsTotal,
    error_latitude: point.nmeaData?.gst?.latitudeError,
    error_longitude: point.nmeaData?.gst?.longitudeError,
    error_altitude: point.nmeaData?.gst?.heightError,
    // Add user ID information
    created_by: point.properties?.userId,
    // Add timestamp
    created_at: point.created_at
  };
};

export const syncService = {
  // Check if device is online
  isOnline: async (): Promise<boolean> => {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
  },
  
  // Sync points with the server for a specific project
  syncPoints: async (projectId: number): Promise<SyncResult> => {
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
      const online = await syncService.isOnline();
      if (!online) {
        return { 
          success: false, 
          syncedCount: 0, 
          failedCount: 0,
          errorMessage: 'Device is offline' 
        };
      }
      
      // Get unsynced points for this project from storageService
      const unsyncedPoints = await storageService.getUnsyncedPointsForProject(projectId);
      
      if (unsyncedPoints.length === 0) {
        return { 
          success: true, 
          syncedCount: 0, 
          failedCount: 0 
        };
      }
      
      console.log(`Syncing ${unsyncedPoints.length} points for project ${projectId}...`);
      
      // Format points as expected by the backend
      const formattedPoints = unsyncedPoints.map(formatPointForAPI);
      
      // Log the first formatted point for debugging
      if (formattedPoints.length > 0) {
        console.log('First formatted point for API:', JSON.stringify(formattedPoints[0]));
      }
      
      // Construct the endpoint URL with the project ID
      const endpoint = API_ENDPOINTS.SYNC_POINTS.replace(':projectId', projectId.toString());
      console.log(`Making API call to: ${endpoint}`);
      
      // Send points to server with explicit error handling
      try {
        // IMPORTANT: Structure the payload exactly as your backend expects it
        // This field naming and structure is critical
        const payload = {
          points: formattedPoints
        };
        
        console.log('Full request payload:', JSON.stringify(payload));
        
        const response = await api.post(endpoint, payload);
        
        console.log('API response:', response.data);
        
        if (response.data && response.data.success) {
          const syncedIds = response.data.syncedIds || 
                           response.data.created_ids || 
                           unsyncedPoints.map(p => p.id);
          
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
      } catch (error: any) {
        console.error('API Error:', error);
        
        // Log the response data if available
        if (error.response) {
          console.error('Response data:', error.response.data);
          console.error('Response status:', error.response.status);
        }
        
        // Provide more detailed error information
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
          failedCount: unsyncedPoints.length,
          errorMessage
        };
      }
    } catch (error) {
      console.error(`Error syncing points for project ${projectId}:`, error);
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
  
  // Sync all points across all projects
  syncAllPoints: async (): Promise<SyncResult> => {
    try {
      // Check if online
      const online = await syncService.isOnline();
      if (!online) {
        return { 
          success: false, 
          syncedCount: 0,
          failedCount: 0,
          errorMessage: 'Device is offline' 
        };
      }
      
      // Get all unsynced points using storageService
      const unsyncedPoints = await storageService.getUnsyncedPoints();
      if (unsyncedPoints.length === 0) {
        return { success: true, syncedCount: 0, failedCount: 0 };
      }
      
      // Group points by projectId
      const pointsByProject: Record<number, PointCollected[]> = {};
      
      unsyncedPoints.forEach(point => {
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
          // Use the syncPoints function to avoid duplicating code
          const result = await syncService.syncPoints(projectId);
          
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
      console.error('Error in syncAllPoints:', error);
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};