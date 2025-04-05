import { api } from "@/api/clients";
import { FeatureType } from "@/types/featureType.types";
import { API_ENDPOINTS } from "@/api/endpoints";

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
  fetchFeatureTypes: async (projectId: number): Promise<FeatureType[]> => {
    try {
      const endpoint = buildEndpoint(API_ENDPOINTS.FEATURE_TYPES, { projectId });
      const response = await api.get(endpoint);
      
      if (!response.data.success) {
        throw new Error('Failed to fetch feature types');
      }

      return response.data.features.map((feature: any) => ({
        id: feature.id || '',
        name: feature.name,
        type: feature.type,
        color: feature.color || '#000000',
        line_weight: feature.line_weight || 1,
        dash_pattern: feature.dash_pattern || '',
        label: feature.label || '',
        svg: feature.svg || '',
        draw_layer: feature.draw_layer || 'default',
        z_value: feature.z_value || 0,
        created_by: 'system',
        created_at: new Date().toISOString(),
        updated_by: 'system',
        updated_at: new Date().toISOString(),
        is_active: true,
        image_url: feature.image_url || null
      }));
    } catch (error) {
      return handleApiError(error, 'fetchFeatureTypes');
    }
  },

  inactivateFeature: async (projectId: number, featureId: string): Promise<void> => {
    try {
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