import { api } from "@/api/clients";
import { PointCollected } from "@/types/pointCollected.types";
import { API_ENDPOINTS } from "@/api/endpoints";
import { generateId } from "@/utils/collections";
import { ApiFeature } from "@/types/currentFeatures.types";

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

export const collectedFeatureService = {
  inactivateFeature: async (projectId: number, featureId: string): Promise<void> => {
    try {
      const endpoint = buildEndpoint(API_ENDPOINTS.INACTIVATE_FEATURE, { projectId, featureId });
      const response = await api.post(endpoint);
      
      if (!response.data.success) {
        throw new Error('Failed to inactivate feature');
      }
      return;
    } catch (error) {
      handleApiError(error, 'inactivateFeature');
    }
  },

  fetchActiveFeatures: async (projectId: number): Promise<ApiFeature[]> => {
    try {
      const endpoint = buildEndpoint(API_ENDPOINTS.ACTIVE_FEATURES, { projectId });
      const response = await api.get(endpoint);
      
      if (!response.data.success) {
        throw new Error('Failed to fetch active features');
      }

      console.log('Raw server response:', JSON.stringify(response.data.features, null, 2));

      return response.data.features.map((feature: any) => {
        console.log('Processing feature:', JSON.stringify(feature, null, 2));
        console.log('Feature points:', JSON.stringify(feature.points, null, 2));
        console.log('Feature coordinates:', JSON.stringify(feature.coordinates, null, 2));
        console.log('Feature properties:', JSON.stringify(feature.properties, null, 2));
        console.log('Feature data:', JSON.stringify(feature.data, null, 2));
        
        return {
          properties: {
            client_id: feature.client_id || generateId(),
            points: feature.points || [],
            ...feature
          },
          data: feature.data || {},
          featureTypeId: feature.featureTypeId || feature.id,
          featureType: feature.featureType || feature,
          id: feature.id,
          is_active: feature.is_active !== false,
          created_by: feature.created_by || null,
          created_at: feature.created_at || new Date().toISOString(),
          updated_by: feature.updated_by || null,
          updated_at: feature.updated_at || new Date().toISOString()
        };
      });
    } catch (error) {
      handleApiError(error, 'fetchActiveFeatures');
      return []; // Return empty array in case of error
    }
  }
}; 