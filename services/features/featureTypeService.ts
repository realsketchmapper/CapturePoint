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
        console.log("Raw response:", JSON.stringify(response.data, null, 2));
        
        // Ensure all features have required properties while preserving existing ones
        const features = response.data.features.map((feature: any) => {
          console.log("Processing feature:", feature);
          return {
            id: feature.id,
            name: feature.name,
            category: feature.category,
            geometryType: feature.geometryType || feature.type || 'Point',
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
        
        console.log("Processed features:", JSON.stringify(features, null, 2));
        return features;
      }
      throw new Error('Failed to fetch feature');
    } catch (error) {
      console.error('Error in fetchFeatureTypes:', error);
      throw error;
    }
  }
}; 