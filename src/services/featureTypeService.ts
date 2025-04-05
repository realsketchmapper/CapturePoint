import { api } from "@/src/api/clients";
import { FeatureType } from "@/src/types/featureType.types";
import { API_ENDPOINTS } from "@/src/api/endpoints";

/**
 * Service for managing feature types in the application
 */
export const featureTypeService = {
  /**
   * Fetches all feature types for a project
   * @param projectId - The ID of the project to fetch feature types for
   * @returns A promise that resolves to an array of feature types
   */
  fetchProjectFeatureTypes: async (projectId: number): Promise<FeatureType[]> => {
    try {
      const response = await api.get(`/projects/${projectId}/features`);
      
      if (!response.data.success) {
        throw new Error('Failed to fetch feature types');
      }
      
      // Map and normalize the feature types
      return response.data.features.map((feature: any) => ({
        ...feature,
        image_url: feature.image_url || null,
        coordinates: feature.coordinates || [],
        properties: feature.properties || {}
      }));
    } catch (error) {
      console.error('Error in fetchProjectFeatureTypes:', error);
      throw error;
    }
  },

  /**
   * Fetches active feature types for a project
   * @param projectId - The ID of the project to fetch active feature types for
   * @returns A promise that resolves to an array of active feature types
   */
  fetchActiveFeatureTypes: async (projectId: number): Promise<FeatureType[]> => {
    try {
      const endpoint = API_ENDPOINTS.ACTIVE_FEATURES
        .replace(':projectId', projectId.toString())
        .replace(/^\//, '');
      
      const response = await api.get(endpoint);
      
      if (!response.data.success) {
        throw new Error('Failed to fetch active feature types');
      }
      
      // Map and normalize the active feature types
      return response.data.features.map((feature: any) => ({
        id: feature.id,
        type: feature.type,
        name: feature.name,
        draw_layer: feature.draw_layer,
        coordinates: feature.coordinates || [],
        properties: feature.properties || {},
        image_url: feature.image_url || null,
        svg: feature.svg || '',
        color: feature.color || '#000000',
        line_weight: feature.line_weight || 1,
        dash_pattern: feature.dash_pattern || '',
        label: feature.label || '',
        z_value: feature.z_value || 0,
        created_by: feature.created_by || '',
        created_at: feature.created_at || new Date().toISOString(),
        updated_at: feature.updated_at || new Date().toISOString(),
        is_active: feature.is_active !== false
      }));
    } catch (error) {
      console.error('Error in fetchActiveFeatureTypes:', error);
      throw error;
    }
  },

  /**
   * Inactivates a feature type
   * @param projectId - The ID of the project the feature type belongs to
   * @param featureId - The ID of the feature type to inactivate
   * @returns A promise that resolves when the feature type is inactivated
   */
  inactivateFeatureType: async (projectId: number, featureId: string): Promise<void> => {
    try {
      const endpoint = API_ENDPOINTS.INACTIVATE_FEATURE
        .replace(':projectId', projectId.toString())
        .replace(/^\//, '');
      
      const response = await api.post(endpoint, {
        feature_id: featureId,
        client_id: featureId  // The client_id is the same as the feature_id for points
      });
      
      if (!response.data.success) {
        // If the error indicates the feature is already inactive, treat it as a success
        if (response.data.error?.includes('already inactive') || response.data.error?.includes('not found')) {
          return;
        }
        throw new Error(response.data.error || 'Failed to inactivate feature type');
      }
    } catch (error) {
      console.error('Error in inactivateFeatureType:', error);
      throw error;
    }
  }
}; 