import { api } from "@/api/clients";
import { FeatureType } from "@/types/features.types";
import { API_ENDPOINTS } from "@/api/endpoints";

export const featureTypeService = {
  fetchFeatureTypes: async (projectId: number): Promise<FeatureType[]> => {
    try {
      console.log("projectId in feature service:", projectId);
      const endpoint = API_ENDPOINTS.PROJECT_FEATURE_TYPES.replace(':projectId', projectId.toString()).replace(/^\//, '');
      const response = await api.get(endpoint);
      
      if (response.data.success) {
        // Log some data about the features for debugging
        console.log("Feature types loaded");
        console.log(`Found ${response.data.features.length} feature types`);
        
        // Ensure all features have required properties while preserving existing ones
        const features = response.data.features.map((feature: any) => {
          console.log("Processing feature:", feature.id, feature.name);
          
          // Validate required fields
          if (!feature.id || !feature.name) {
            console.error("Invalid feature type:", feature);
            throw new Error(`Invalid feature type: missing required fields (id: ${feature.id}, name: ${feature.name})`);
          }
          
          // Determine geometry type from type field or default to Point
          const geometryType = feature.geometryType || feature.type || 'Point';
          
          return {
            id: feature.id,
            name: feature.name,
            category: feature.category,
            geometryType,
            image_url: feature.image_url || null,
            svg: feature.svg || null,
            color: feature.color || '#000000',
            line_weight: feature.line_weight || 1,
            dash_pattern: feature.dash_pattern || '',
            z_value: feature.z_value || 0,
            draw_layer: feature.draw_layer || 'default',
            is_active: feature.is_active !== false,
            attributes: feature.properties || feature || {},
            coordinates: feature.coordinates || []
          };
        });
        
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
          id: feature.id,
          name: feature.name,
          category: feature.category,
          geometryType: feature.geometryType || feature.type || 'Point',
          image_url: feature.image_url || null,
          svg: feature.svg || '',
          color: feature.color || '#000000',
          line_weight: feature.line_weight || 1,
          dash_pattern: feature.dash_pattern || '',
          z_value: feature.z_value || 0,
          draw_layer: feature.draw_layer || 'default',
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