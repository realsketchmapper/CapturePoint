import { Project } from '@/types/project.types';
import { api } from '@/api/clients';
import { API_ENDPOINTS } from '@/api/endpoints';
import { ApiResponse } from '@/types/api.types';

class ProjectService {
  async fetchProjects(): Promise<Project[]> {
    try {
      console.log('Fetching projects...');
      const response = await api.get<ApiResponse<Project[]>>(API_ENDPOINTS.PROJECTS);
      console.log('API Response:', response.data);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch projects');
      }
      
      return response.data.projects || [];
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  }
}

export const projectService = new ProjectService();