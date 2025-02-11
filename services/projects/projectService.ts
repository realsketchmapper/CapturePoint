import { Project } from '@/types/project.types';
import { api } from '@/api/client';
import { API_ENDPOINTS } from '@/api/endpoints';

interface ApiResponse<T> {
  success: boolean;
  error?: string;
  projects?: T;
}

interface ProjectData {
  // Define your project data structure here
  latitude: number;
  longitude: number;
  timestamp: string;
  featureType?: string;
  measurements?: {
    width?: number;
    length?: number;
    height?: number;
  };
  // Add other fields as needed
}

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

  async getProjectById(id: number): Promise<Project> {
    try {
      const response = await api.get<ApiResponse<Project>>(`${API_ENDPOINTS.PROJECTS}/${id}`);
      
      if (!response.data.success || !response.data.projects) {
        throw new Error('Project not found');
      }
      
      return response.data.projects;
    } catch (error) {
      console.error(`Error fetching project ${id}:`, error);
      throw error;
    }
  }

  async saveProjectData(projectId: number, data: ProjectData[]): Promise<void> {
    try {
      const response = await api.post(`${API_ENDPOINTS.PROJECTS}/${projectId}/data`, {
        data,
        timestamp: new Date().toISOString()
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to save project data');
      }
    } catch (error) {
      console.error('Error saving project data:', error);
      throw error;
    }
  }

  async getProjectData(projectId: number): Promise<ProjectData[]> {
    try {
      const response = await api.get<ApiResponse<ProjectData[]>>(
        `${API_ENDPOINTS.PROJECTS}/${projectId}/data`
      );
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch project data');
      }
      
      return response.data.projects || [];
    } catch (error) {
      console.error('Error fetching project data:', error);
      throw error;
    }
  }

  async updateProject(id: number, updates: Partial<Project>): Promise<Project> {
    try {
      const response = await api.patch<ApiResponse<Project>>(
        `${API_ENDPOINTS.PROJECTS}/${id}`,
        updates
      );
      
      if (!response.data.success || !response.data.projects) {
        throw new Error('Failed to update project');
      }
      
      return response.data.projects;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }

  async deleteProject(id: number): Promise<void> {
    try {
      const response = await api.delete<ApiResponse<void>>(`${API_ENDPOINTS.PROJECTS}/${id}`);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }
}

export const projectService = new ProjectService();