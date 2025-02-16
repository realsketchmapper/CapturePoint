import { api } from "@/api/clients";
import { API_ENDPOINTS } from "@/api/endpoints";
import { Feature } from "@/types/features.types";

interface ApiResponse<T> {
  success: boolean;
  error?: string;
  data: T;
}

export class FeaturesService {
  static async getFeatures(): Promise<Feature[]> {
    try {
      
      const response = await api.get<ApiResponse<Feature[]>>(
        API_ENDPOINTS.FEATURES
       
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch features');
      }

      // Check if data exists
      if (!response.data.data || !Array.isArray(response.data.data)) {
        console.log('No features data found or invalid format');
        return [];
      }

      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching features:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          params: error.config?.params
        }
      });

      throw new Error(error.message || 'Failed to fetch features');
    }
  }
}