import { api } from "@/api/clients";
import { PointCollected } from "@/types/pointCollected.types";
import { API_ENDPOINTS } from "@/api/endpoints";
import { generateId } from "@/utils/collections";

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

  fetchActiveFeatures: async (projectId: number): Promise<PointCollected[]> => {
    try {
      const endpoint = buildEndpoint(API_ENDPOINTS.ACTIVE_FEATURES, { projectId });
      const response = await api.get(endpoint);
      
      if (!response.data.success) {
        throw new Error('Failed to fetch active features');
      }

      return response.data.features.map((feature: any) => ({
        client_id: feature.properties?.client_id || generateId(),
        featureTypeId: feature.featureTypeId || feature.id,
        featureType: feature.featureType || feature,
        project_id: projectId,
        points: feature.properties?.points || [],
        attributes: feature.properties || {},
        is_active: feature.is_active !== false,
        created_by: feature.created_by || null,
        created_at: feature.created_at || new Date().toISOString(),
        updated_by: feature.updated_by || null,
        updated_at: feature.updated_at || new Date().toISOString()
      }));
    } catch (error) {
      handleApiError(error, 'fetchActiveFeatures');
      return []; // Return empty array in case of error
    }
  }
}; 