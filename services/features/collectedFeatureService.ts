import { api } from "@/api/clients";
import { API_ENDPOINTS } from "@/api/endpoints";
import { FeatureType } from "@/types/features.types";
import { generateClientId } from '@/utils/collections';

export const collectedFeatureService = {
  inactivateFeature: async (projectId: number, featureId: string): Promise<void> => {
    try {
      // Remove the leading slash since the base URL will include it
      const endpoint = API_ENDPOINTS.INACTIVATE_FEATURE
        .replace(':projectId', projectId.toString())
        .replace(/^\//, '');
      
      console.log('Inactivating feature with endpoint:', endpoint);
      const response = await api.post(endpoint, {
        feature_id: featureId,
        client_id: generateClientId()  // Generate a proper client ID
      });
      
      if (!response.data.success) {
        // If the error indicates the feature is already inactive, treat it as a success
        if (response.data.error?.includes('already inactive') || response.data.error?.includes('not found')) {
          console.log('Feature was already inactive or not found');
          return;
        }
        throw new Error(response.data.error || 'Failed to inactivate feature');
      }
    } catch (error) {
      console.error('Error in inactivateFeature:', error);
      throw error;
    }
  },

  fetchActiveFeatures: async (projectId: number): Promise<FeatureType[]> => {
    try {
      console.log("Fetching active features for project:", projectId);
      // Remove the leading slash since the base URL will include it
      const endpoint = API_ENDPOINTS.ACTIVE_PROJECT_COLLECTED_FEATURES.replace(':projectId', projectId.toString()).replace(/^\//, '');
      
      const response = await api.get(endpoint);
      
      if (response.data.success) {
        console.log("Active features count:", response.data.features.length);
        // Ensure all features have required properties
        const features = response.data.features.map((feature: any) => ({
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
        return features;
      }
      throw new Error('Failed to fetch active features');
    } catch (error) {
      console.error('Error in fetchActiveFeatures:', error);
      throw error;
    }
  }
}; 