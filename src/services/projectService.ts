import { Project } from '@/src/types/project.types';
import { api } from '@/src/api/clients';
import { API_ENDPOINTS } from '@/src/api/endpoints';
import { ApiResponse } from '@/src/types/api.types';

/**
 * Service class for handling project-related operations
 * Provides methods to interact with the project API endpoints
 */
class ProjectService {
  /**
   * Fetches all projects from the API
   * @returns A promise that resolves to an array of Project objects
   * @throws Error if the API request fails or returns an error
   */
  async fetchProjects(): Promise<Project[]> {
    try {
      const response = await api.get<ApiResponse<Project[]>>(API_ENDPOINTS.PROJECTS);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch projects');
      }
      
      return response.data.projects || [];
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error fetching projects: ${error.message}`);
      }
      throw new Error('An unknown error occurred while fetching projects');
    }
  }
}

export const projectService = new ProjectService(); 