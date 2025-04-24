import { api } from "@/api/clients";
import { API_ENDPOINTS } from "@/api/endpoints";
import { CollectedFeature } from "@/types/currentFeatures.types";

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

  fetchActiveFeatures: async (projectId: number): Promise<CollectedFeature[]> => {
    try {
      const endpoint = buildEndpoint(API_ENDPOINTS.ACTIVE_FEATURES, { projectId });
      const response = await api.get(endpoint);
      
      if (!response.data.success || !response.data.features) {
        throw new Error('Failed to fetch active features');
      }

      return response.data.features.map((feature: any) => {
        if (!feature.created_by || !feature.updated_by) {
          throw new Error(`Invalid feature data: missing required user information for feature ${feature.id}`);
        }

        return {
          name: feature.name,
          draw_layer: feature.draw_layer,
          client_id: feature.client_id,
          project_id: feature.project_id,
          points: feature.points || [],
          attributes: feature.attributes || {},
          is_active: true,
          created_by: feature.created_by,
          created_at: feature.created_at,
          updated_by: feature.updated_by,
          updated_at: feature.updated_at
        };
      });
    } catch (error) {
      handleApiError(error, 'fetchActiveFeatures');
      return [];
    }
  }
}; 