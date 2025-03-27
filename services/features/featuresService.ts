import { api } from "@/api/clients";
import { API_ENDPOINTS } from "@/api/endpoints";
import { UtilityFeatureType } from "@/types/features.types";
import NetInfo from "@react-native-community/netinfo";
import { tokenStorage } from "@/services/auth/tokenStorage";

export const featureService = {
  fetchFeatureTypes: async (projectId: number): Promise<UtilityFeatureType[]> => {
    try {
<<<<<<< HEAD
      const response = await api.get(`/projects/${projectId}/features`);
=======
      console.log("Fetching feature types for project:", projectId);
      
      // Log network state
      const networkState = await NetInfo.fetch();
      console.log('Network state:', {
        isConnected: networkState.isConnected,
        type: networkState.type,
        isInternetReachable: networkState.isInternetReachable
      });
      
      // Log auth state
      const credentials = await tokenStorage.getStoredCredentials();
      console.log('Auth state:', {
        hasToken: !!credentials?.token,
        userId: credentials?.userId
      });
      
      const endpoint = API_ENDPOINTS.PROJECT_FEATURES.replace(':projectId', projectId.toString()).replace(/^\//, '');
      console.log('Using endpoint:', endpoint);
      console.log('Full URL:', `${API_ENDPOINTS.BASE_URL}/${endpoint}`);
      
      const response = await api.get(endpoint);
>>>>>>> 348a764b70443cc6c7b0062fec508b804d967804
      
      // Log some data about the features for debugging
      console.log("Features count:", response.data.features.length);
      console.log("Feature types loaded");
      
      if (response.data.success) {
<<<<<<< HEAD
        console.log("Features loaded");
        // Ensure all features have either an image_url or fallback
        const features = response.data.features.map((feature: any) => ({
          ...feature,
          // If neither image_url nor svg exists, you might want to set a default
          image_url: feature.image_url || null,
          coordinates: feature.coordinates || [],
          properties: feature.properties || {}
        }));
=======
        console.log("Raw feature response:", JSON.stringify(response.data, null, 2));
        const features = response.data.features.map((feature: any) => {
          // Log the raw feature data to see what we're getting
          console.log("Raw feature data:", JSON.stringify(feature, null, 2));
          
          if (!feature) {
            console.error('Feature is undefined');
            return null;
          }

          // Get type from properties or feature itself
          const geometryType = feature.properties?.type || feature.type || 'Point';
          
          // For debugging
          console.log('Processing feature:', {
            rawFeature: feature,
            properties: feature.properties,
            type: geometryType
          });
          
          return {
            id: feature.properties?.id || feature.id,
            name: feature.properties?.name || feature.name,
            category: feature.properties?.category || feature.category,
            geometryType: geometryType,
            // Only use image_url for Point features
            image_url: geometryType === 'Point' ? (feature.properties?.image_url || feature.image_url) : null,
            // Use SVG for Line and Polygon features
            svg: (geometryType === 'Line' || geometryType === 'Polygon') ? (feature.properties?.svg || feature.svg) : null,
            color: feature.properties?.color || feature.color || '#000000',
            line_weight: feature.properties?.lineWeight || feature.line_weight || 1,
            dash_pattern: feature.properties?.dashPattern || feature.dash_pattern || '',
            z_value: feature.properties?.z_value || feature.z_value || 0,
            draw_layer: feature.properties?.draw_layer || feature.draw_layer || 'default',
            is_active: true, // These are always active features from the endpoint
            attributes: feature.properties || feature || {}
          };
        }).filter(Boolean); // Remove any null features
        
        // Log each feature's SVG content
        features.forEach((f: UtilityFeatureType) => {
          if (f.geometryType === 'Line' || f.geometryType === 'Polygon') {
            console.log(`SVG for ${f.name}:`, {
              type: f.geometryType,
              svg: f.svg,
              color: f.color
            });
          }
        });
        
>>>>>>> 348a764b70443cc6c7b0062fec508b804d967804
        return features;
      }
      throw new Error('Failed to fetch feature types');
    } catch (error) {
      console.error('Error in fetchFeatureTypes:', error);
      throw error;
    }
  },

  fetchActiveFeatures: async (projectId: number): Promise<UtilityFeatureType[]> => {
    try {
      console.log("Fetching active features for project:", projectId);
      // Remove the leading slash since the base URL will include it
      const endpoint = API_ENDPOINTS.ACTIVE_FEATURES.replace(':projectId', projectId.toString()).replace(/^\//, '');
      console.log('Using endpoint:', endpoint);
      const response = await api.get(endpoint);
      
      if (response.data.success) {
        console.log("Active features count:", response.data.features.length);
        // Ensure all features have required properties
        const features = response.data.features.map((feature: any) => ({
          id: feature.id,
          name: feature.name,
          draw_layer: feature.draw_layer,
          coordinates: feature.coordinates || [],
          attributes: feature.properties || {},
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
  },

  inactivateFeature: async (projectId: number, featureId: string): Promise<void> => {
    try {
      // Remove the leading slash since the base URL will include it
      const endpoint = API_ENDPOINTS.INACTIVATE_FEATURE
        .replace(':projectId', projectId.toString())
        .replace(/^\//, '');
      
      console.log('Inactivating feature with endpoint:', endpoint);
      const response = await api.post(endpoint, {
        feature_id: featureId,
        client_id: featureId  // The client_id is the same as the feature_id for points
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
  }
};