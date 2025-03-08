import { api } from "@/api/clients";
import { Feature } from "@/types/features.types";

export const featureService = {
  fetchProjectFeatures: async (projectId: number): Promise<Feature[]> => {
    try {
      console.log("projectId in feature service:", projectId);
      const response = await api.get(`/projects/${projectId}/features`);
      
      if (response.data.success) {
        console.log("features", response.data.features);
        // Log some data about the features for debugging
        console.log("Feature response:", 
          response.data.features.map((f: any) => ({ 
            id: f.id, 
            name: f.name, 
            has_image_url: !!f.image_url, 
            image_url_sample: f.image_url ? f.image_url.substring(0, 30) + '...' : 'none' 
          }))
        );
        
        // Ensure all features have either an image_url or fallback
        const features = response.data.features.map((feature: Feature) => ({
          ...feature,
          // If neither image_url nor svg exists, you might want to set a default
          image_url: feature.image_url || null
        }));
        return features;
      }
      throw new Error('Failed to fetch features');
    } catch (error) {
      console.error('Error in fetchProjectFeatures:', error);
      throw error;
    }
  }
};