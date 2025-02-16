import { api } from "@/api/clients";
import { Feature } from "@/types/features.types";

export const featureService = {
  fetchProjectFeatures: async (projectId: number): Promise<Feature[]> => {
    try {
      console.log("projectId in feature service:", projectId);
      const response = await api.get(`/projects/${projectId}/features`);
      
      if (response.data.success) {
        console.log("features", response.data.features);
        return response.data.features;
      }
      throw new Error('Failed to fetch features');
    } catch (error) {
      console.error('Error in fetchProjectFeatures:', error);
      throw error;
    }
  }
};