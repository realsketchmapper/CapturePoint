import { Project, ProjectAttributes, UserFootageSummary } from '@/types/project.types';
import { api } from '@/api/clients';
import { API_ENDPOINTS } from '@/api/endpoints';
import { ApiResponse } from '@/types/api.types';
import { projectStorageService } from '@/services/storage/projectStorageService';
import NetInfo from '@react-native-community/netinfo';

/**
 * Service class for handling project-related operations
 * Provides methods to interact with the project API endpoints
 * and local storage for offline mode support
 */
class ProjectService {
  /**
   * Checks if the device is online
   * @returns Promise resolving to boolean indicating online status
   */
  private async isOnline(): Promise<boolean> {
    try {
      console.log('Checking network connectivity for projects...');
      const networkState = await NetInfo.fetch();
      const isConnected = !!networkState.isConnected;
      console.log(`Network status for projects: ${isConnected ? 'Online' : 'Offline'}`);
      return isConnected;
    } catch (error) {
      console.error('Error checking network connectivity:', error);
      return false;
    }
  }





  /**
   * Fetches all projects from the API or local storage if offline
   * @returns A promise that resolves to an array of Project objects
   * @throws Error if the API request fails or returns an error and no offline data is available
   */
  async fetchProjects(): Promise<Project[]> {
    console.log('=== ProjectService: fetchProjects called ===');
    try {
      // Check if we're online
      console.log('Checking network status...');
      const online = await this.isOnline();
      
      if (!online) {
        console.log('Device is offline, loading projects from local storage');
        
        // Import any legacy projects first
        console.log('Checking for legacy projects to import');
        await this.importLegacyProjects();
        
        const offlineProjects = await projectStorageService.getStoredProjects();
        console.log(`Loaded ${offlineProjects.length} projects from local storage:`, JSON.stringify(offlineProjects));
        
        if (offlineProjects.length === 0) {
          console.log('WARNING: No offline projects found in storage');
        } else {
          console.log('Project IDs in storage:', offlineProjects.map(p => p.id).join(', '));
        }
        
        return offlineProjects;
      }
      
      console.log('Device is online, fetching projects from API');
      const response = await api.get<ApiResponse<Project[]>>(API_ENDPOINTS.PROJECTS);
      
      if (!response.data.success) {
        console.error('API returned error:', response.data.error);
        throw new Error(response.data.error || 'Failed to fetch projects');
      }
      
      const projects = response.data.projects || [];
      console.log(`Fetched ${projects.length} projects from API:`, JSON.stringify(projects));
      
      // Store projects locally for offline access
      console.log('Storing projects for offline use...');
      await projectStorageService.storeProjects(projects);
      console.log('Projects cached successfully for offline use');
      
      return projects;
    } catch (error) {
      console.error('Error in fetchProjects:', error);
      
      // Try to load from storage as fallback
      console.log('Attempting to load projects from local storage as fallback');
      
      // Import any legacy projects first
      console.log('Checking for legacy projects to import in fallback path');
      await this.importLegacyProjects();
      
      // Debug: Verify storage directly
      await projectStorageService.debugVerifyStorage();
      
      const offlineProjects = await projectStorageService.getStoredProjects();
      
      if (offlineProjects.length > 0) {
        console.log(`Loaded ${offlineProjects.length} projects from local storage as fallback:`, JSON.stringify(offlineProjects));
        console.log('Project IDs in storage:', offlineProjects.map(p => p.id).join(', '));
        return offlineProjects;
      }
      
      console.error('No offline projects available and online fetch failed');
      // No offline data available, propagate the error
      if (error instanceof Error) {
        throw new Error(`Error fetching projects: ${error.message}`);
      }
      throw new Error('An unknown error occurred while fetching projects');
    }
  }

  /**
   * Import any legacy project data from different storage formats
   * @returns A promise that resolves when the import is complete, returning any imported projects
   */
  async importLegacyProjects(): Promise<Project[]> {
    console.log('=== ProjectService: importLegacyProjects called ===');
    try {
      // Set a flag to prevent running this multiple times in quick succession
      if ((this as any)._importingLegacy) {
        console.log('Legacy project import already in progress, skipping duplicate call');
        return [];
      }
      
      (this as any)._importingLegacy = true;
      
      try {
        // Run diagnostics to help understand storage state
        console.log('Running storage diagnostics before import');
        await this.debugStorage();
        
        // Use the storage service to find and import legacy projects
        const importedProjects = await projectStorageService.importLegacyProjects();
        
        if (importedProjects.length > 0) {
          console.log(`Successfully imported ${importedProjects.length} legacy projects`);
          console.log('Imported project IDs:', importedProjects.map(p => p.id).join(', '));
          
          // Run diagnostics again to see changes
          console.log('Running storage diagnostics after import');
          await this.debugStorage();
        } else {
          console.log('No legacy projects found to import');
        }
        
        return importedProjects;
      } finally {
        // Clear flag when done
        (this as any)._importingLegacy = false;
      }
    } catch (error) {
      console.error('Error in importLegacyProjects:', error);
      // Clear flag on error
      (this as any)._importingLegacy = false;
      return [];
    }
  }

  /**
   * Debug method to examine storage contents
   * Helps diagnose issues with project storage
   */
  async debugStorage(): Promise<void> {
    console.log('=== ProjectService: Running storage diagnostics ===');
    try {
      await projectStorageService.debugStorageContents();
      console.log('=== Storage diagnostics complete ===');
    } catch (error) {
      console.error('Error running storage diagnostics:', error);
    }
  }
}

export const projectService = new ProjectService(); 