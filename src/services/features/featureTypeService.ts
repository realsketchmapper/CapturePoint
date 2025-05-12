import { api } from "@/api/clients";
import { FeatureType } from "@/types/featureType.types";
import { API_ENDPOINTS } from "@/api/endpoints";
import { featureTypeStorageService } from "@/services/storage/featureTypeStorageService";
import NetInfo from '@react-native-community/netinfo';

// Helper function to handle API errors
const handleApiError = (error: unknown, operation: string): never => {
  console.error(`Error in ${operation}:`, error);
  throw error;
};

// Helper function to build endpoint URL
const buildEndpoint = (endpoint: string, params: Record<string, string | number>): string => {
  return Object.entries(params).reduce(
    (url, [key, value]) => url.replace(`:${key}`, value.toString()),
    endpoint.replace(/^\//, '')
  );
};

export const featureTypeService = {
  /**
   * Checks if the device is online
   * @returns Promise resolving to boolean indicating online status
   */
  isOnline: async (): Promise<boolean> => {
    try {
      console.log('Checking network connectivity for feature types...');
      const networkState = await NetInfo.fetch();
      const isConnected = !!networkState.isConnected;
      console.log(`Network status for feature types: ${isConnected ? 'Online' : 'Offline'}`);
      return isConnected;
    } catch (error) {
      console.error('Error checking network connectivity:', error);
      return false;
    }
  },

  /**
   * Fetches feature types for a project, with offline support
   * @param projectId The project ID to fetch feature types for
   * @returns Promise resolving to an array of feature types
   */
  fetchFeatureTypes: async (projectId: number): Promise<FeatureType[]> => {
    try {
      // Check if we're online
      const online = await featureTypeService.isOnline();
      
      if (!online) {
        console.log('Device is offline, loading feature types from local storage');
        return await featureTypeStorageService.getStoredFeatureTypes(projectId);
      }
      
      console.log('Device is online, fetching feature types from API');
      const endpoint = buildEndpoint(API_ENDPOINTS.FEATURE_TYPES, { projectId });
      const response = await api.get(endpoint);
      
      if (!response.data.success) {
        throw new Error('Failed to fetch feature types');
      }

      const featureTypes = response.data.features.map((feature: any) => {
        // Ensure color is properly formatted
        let color = feature.color || '#000000';
        if (color && !color.startsWith('#')) {
          // If color appears to be hex without #, add it
          if (/^[0-9A-Fa-f]{6}$/.test(color)) {
            color = `#${color}`;
            console.log('Fixed color format in feature type by adding # prefix:', color);
          } else {
            // If color is invalid, fallback to a safe default
            console.warn('Invalid color format detected in feature type:', color, 'falling back to default');
            color = '#000000';
          }
        }

        return {
          id: feature.id || '',
          name: feature.name,
          type: feature.type,
          color: color,
          line_weight: feature.line_weight || 3,
          dash_pattern: feature.dash_pattern || '',
          label: feature.label || '',
          svg: feature.svg || '',
          draw_layer: feature.draw_layer || 'default',
          z_value: feature.z_value || 0,
          is_active: true,
          image_url: feature.image_url || null
        };
      });
      
      // Store feature types locally for offline access
      await featureTypeStorageService.storeFeatureTypes(projectId, featureTypes);
      console.log(`Stored ${featureTypes.length} feature types for offline use`);
      
      return featureTypes;
    } catch (error) {
      console.error('Error fetching feature types:', error);
      
      // Try to load from storage as fallback
      console.log('Attempting to load feature types from local storage as fallback');
      const offlineFeatureTypes = await featureTypeStorageService.getStoredFeatureTypes(projectId);
      
      if (offlineFeatureTypes.length > 0) {
        console.log(`Loaded ${offlineFeatureTypes.length} feature types from local storage as fallback`);
        return offlineFeatureTypes;
      }
      
      // No offline data available, propagate the error
      return handleApiError(error, 'fetchFeatureTypes');
    }
  },

  inactivateFeature: async (projectId: number, featureId: string): Promise<void> => {
    try {
      // Check if we're online first
      const online = await featureTypeService.isOnline();
      
      if (!online) {
        console.log('Device is offline, cannot inactivate feature');
        throw new Error('Cannot inactivate feature while offline');
      }
      
      const endpoint = buildEndpoint(API_ENDPOINTS.INACTIVATE_FEATURE, { projectId, featureId });
      const response = await api.post(endpoint);
      
      if (!response.data.success) {
        throw new Error('Failed to inactivate feature');
      }
      return;
    } catch (error) {
      return handleApiError(error, 'inactivateFeature');
    }
  }
};