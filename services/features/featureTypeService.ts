import { api } from "@/api/clients";
import { FeatureType } from "@/types/features.types";
import { API_ENDPOINTS } from "@/api/endpoints";

export const featureTypeService = {
  fetchFeatureTypes: async (projectId: number): Promise<FeatureType[]> => {
    try {
      console.log("projectId in feature service:", projectId);
      const endpoint = API_ENDPOINTS.PROJECT_FEATURE_TYPES.replace(':projectId', projectId.toString());
      console.log("Fetching feature types from endpoint:", endpoint);
      const response = await api.get(endpoint);
      
      if (response.data.success) {
        console.log("Feature types loaded");
        console.log(`Found ${response.data.features.length} feature types`);
        
        const features = response.data.features.map((feature: any) => ({
          id: feature.id,
          name: feature.name,
          category: feature.draw_layer,
          geometryType: feature.type,
          image_url: feature.type === 'Point' ? feature.image_url : null,
          svg: (feature.type === 'Line' || feature.type === 'Polygon') ? feature.svg : null,
          color: feature.color || '#000000',
          line_weight: feature.line_weight || 1,
          dash_pattern: feature.dash_pattern || '',
          z_value: feature.z_value || 0,
          draw_layer: feature.draw_layer || 'default',
          is_active: feature.is_active !== false,
          attributes: feature
        }));
        
        console.log(`Successfully processed ${features.length} feature types`);
        return features;
      }
      throw new Error('Failed to fetch feature');
    } catch (error) {
      console.error('Error in fetchFeatureTypes:', error);
      throw error;
    }
  },

  inactivateFeature: async (projectId: number, featureId: string): Promise<void> => {
    try {
      const endpoint = API_ENDPOINTS.INACTIVATE_FEATURE.replace(':projectId', projectId.toString())
        .replace(':featureId', featureId)
        .replace(/^\//, '');
      
      const response = await api.post(endpoint);
      
      if (!response.data.success) {
        throw new Error('Failed to inactivate feature');
      }
    } catch (error) {
      console.error('Error inactivating feature:', error);
      throw error;
    }
  },

  fetchActiveFeatures: async (projectId: number): Promise<FeatureType[]> => {
    try {
      console.log("Fetching active features for project:", projectId);
      const endpoint = API_ENDPOINTS.ACTIVE_PROJECT_COLLECTED_FEATURES.replace(':projectId', projectId.toString())
        .replace(/^\//, '');
      
      const response = await api.get(endpoint);
      
      if (response.data.success) {
        console.log("Active features count:", response.data.features.length);
        // Ensure all features have required properties
        const features = response.data.features.map((feature: any) => ({
          name: feature.name,
          category: feature.category,
          geometryType: feature.geometryType,
          image_url: feature.image_url,
          svg: feature.svg || '',
          color: feature.color || '#000000',
          line_weight: feature.line_weight || 1,
          dash_pattern: feature.dash_pattern || '',
          z_value: feature.z_value || 0,
          draw_layer: feature.draw_layer,
          is_active: feature.is_active !== false,
          attributes: feature.attributes || {}
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