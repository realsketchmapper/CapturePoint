import { useState, useCallback, useEffect } from 'react';
import { Project } from '@/types/project.types';
import { projectService } from '@/services/project/projectService';
import { projectStorageService } from '@/services/storage/projectStorageService';

/**
 * Custom hook for managing projects
 * Provides state and functions for fetching and managing projects
 * @returns Object containing project state and functions
 */
export const useProjects = () => {
  // State for projects, loading status, and errors
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches projects from the API
   * Updates the projects state with the fetched data
   */
  const fetchProjects = useCallback(async () => {
    console.log('=== useProjects hook: fetchProjects called ===');
    try {
      setLoading(true);
      setError(null);
      console.log('Calling projectService.fetchProjects()');
      const data = await projectService.fetchProjects();
      console.log('Projects received from service:', JSON.stringify(data));
      
      if (data.length === 0) {
        console.log('WARNING: No projects returned from projectService, checking storage directly');
        // Double-check storage directly as a fallback
        const storedProjects = await projectStorageService.forceRefreshFromStorage();
        if (storedProjects.length > 0) {
          console.log(`Found ${storedProjects.length} projects directly in storage`);
          setProjects(storedProjects);
          console.log(`Set projects state with ${storedProjects.length} projects from direct storage`);
          setLoading(false);
          return;
        } else {
          console.log('No projects found in direct storage check either');
        }
      }
      
      setProjects(data);
      console.log(`Set projects state with ${data.length} projects`);
    } catch (err) {
      console.error('Error in useProjects hook:', err);
      
      // Attempt direct storage access as last resort
      console.log('Attempting direct storage access as fallback for error');
      try {
        const directProjects = await projectStorageService.forceRefreshFromStorage();
        if (directProjects.length > 0) {
          console.log(`Recovered ${directProjects.length} projects from direct storage after error`);
          setProjects(directProjects);
          console.log(`Set projects state with recovered projects`);
        } else {
          setError('Error loading projects');
        }
      } catch (storageErr) {
        console.error('Error in direct storage fallback:', storageErr);
        setError('Error loading projects');
      }
    } finally {
      setLoading(false);
      console.log('Finished loading projects, loading state set to false');
    }
  }, []);

  // Fetch projects on component mount
  useEffect(() => {
    console.log('useProjects hook: Initial useEffect running');
    fetchProjects();
  }, [fetchProjects]);

  // Log whenever projects state changes
  useEffect(() => {
    console.log(`Projects state changed: now contains ${projects.length} projects`);
  }, [projects]);

  return { projects, loading, error, fetchProjects };
}; 