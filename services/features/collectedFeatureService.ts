import { api } from "@/api/clients";
import { CollectedFeature } from "@/types/features.types";
import { API_ENDPOINTS } from "@/api/endpoints";
import { generateClientId } from "@/utils/collections";

export const collectedFeatureService = {
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

  fetchActiveFeatures: async (projectId: number): Promise<CollectedFeature[]> => {
    try {
      console.log("Fetching active features for project:", projectId);
      const endpoint = API_ENDPOINTS.ACTIVE_PROJECT_COLLECTED_FEATURES.replace(':projectId', projectId.toString())
        .replace(/^\//, '');
      
      const response = await api.get(endpoint);
      
      if (response.data.success) {
        console.log("Active features count:", response.data.features.length);
        // Convert API response to CollectedFeature format
        const features = response.data.features.map((feature: any) => ({
          client_id: feature.properties?.client_id || generateClientId(),
          featureTypeId: feature.featureTypeId || feature.id,
          featureType: feature.featureType || feature, // The API might include the full feature type
          project_id: projectId,
          points: feature.properties?.points || [],
          attributes: feature.properties || {},
          is_active: feature.is_active !== false,
          created_by: feature.created_by || null,
          created_at: feature.created_at || new Date().toISOString(),
          updated_by: feature.updated_by || null,
          updated_at: feature.updated_at || new Date().toISOString()
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