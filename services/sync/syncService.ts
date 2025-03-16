// services/sync/syncService.ts
import { api } from "@/api/clients";
import { API_ENDPOINTS } from "@/api/endpoints";
import { storageService } from '../storage/storageService';
import NetInfo from '@react-native-community/netinfo';
import { PointCollected } from "@/types/pointCollected.types";
import { AxiosError } from 'axios';

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
  const formattedPoint = {
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
    // Add user ID information
    created_by: point.properties?.userId,
    // Add timestamp
    created_at: point.created_at,
    // Include properties without NMEA data
    properties: point.properties,
    // NMEA data as top-level field
    nmea_data: {
      gga: point.nmeaData.gga,
      gst: point.nmeaData.gst
    }
  };

  console.log("Formatted point for API:", JSON.stringify(formattedPoint, null, 2));
  return formattedPoint;
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
      console.log("\n=== Starting sync process ===");
      // Verify project ID
      if (!projectId) {
        console.log("❌ No project ID provided");
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
      
      // Log the first formatted point for debugging
      if (formattedPoints.length > 0) {
        console.log('📝 First formatted point:', JSON.stringify(formattedPoints[0], null, 2));
      }
      
      // Construct the endpoint URL with the project ID
      const endpoint = API_ENDPOINTS.SYNC_POINTS.replace(':projectId', projectId.toString());
      console.log(`🌐 Making API call to: ${endpoint}`);
      
      // Send points to server with explicit error handling
      try {
        // IMPORTANT: Structure the payload exactly as your backend expects it
        // This field naming and structure is critical
        const payload = {
          points: formattedPoints
        };
        
        console.log('📦 Request payload:', JSON.stringify(payload, null, 2));
        
        const response = await api.post(endpoint, payload);
        
        console.log('📥 API response:', JSON.stringify(response.data, null, 2));
        
        if (response.data && response.data.success) {
          const syncedIds = response.data.syncedIds || 
                           response.data.created_ids || 
                           unsyncedPoints.map(p => p.id);
          
          console.log(`✅ Successfully synced ${syncedIds.length} points`);
          
          // Mark as synced in local storage
          if (syncedIds.length > 0) {
            await storageService.markPointsAsSynced(syncedIds);
            console.log(`📝 Marked ${syncedIds.length} points as synced in local storage`);
          }
          
          return {
            success: true,
            syncedCount: syncedIds.length,
            failedCount: 0
          };
        } else {
          console.log("❌ Sync failed:", response.data?.error || 'Unknown error');
          return {
            success: false,
            syncedCount: 0,
            failedCount: unsyncedPoints.length,
            errorMessage: response.data?.error || 'Sync failed'
          };
        }
      } catch (error) {
        console.error('❌ API Error:', error);
        
        // Log the response data if available
        if (error instanceof AxiosError) {
          if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
          } else if (error.request) {
            console.error('No response received:', error.request);
          } else {
            console.error('Error setting up request:', error.message);
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
        
        return {
          success: false,
          syncedCount: 0,
          failedCount: unsyncedPoints.length,
          errorMessage: error instanceof Error ? error.message : 'Unknown API error'
        };
      }
    } catch (error) {
      console.error(`❌ Error syncing points for project ${projectId}:`, error);
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      console.log("=== Sync process completed ===\n");
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