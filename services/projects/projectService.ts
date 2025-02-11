import { Project } from '@/types/project.types';
import { api } from '@/api/clients';
import { API_ENDPOINTS } from '@/api/endpoints';

interface ApiResponse<T> {
  success: boolean;
  error?: string;
  projects?: T;
}

class ProjectService {
  async fetchProjects(): Promise<Project[]> {
    try {
      console.log('Fetching projects...');
      const response = await api.get<ApiResponse<Project[]>>(API_ENDPOINTS.PROJECTS);
      console.log('API Response:', response.data);
      
      return response.data.projects || [];
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  }

  async getProjectById(id: number): Promise<Project> {
    try {
      const response = await api.get<ApiResponse<Project>>(`${API_ENDPOINTS.PROJECTS}/${id}`);
      if (!response.data.projects) {
        throw new Error('Project not found');
      }
      return response.data.projects;
    } catch (error) {
      console.error(`Error fetching project ${id}:`, error);
      throw error;
    }
  }
}

export const projectService = new ProjectService();