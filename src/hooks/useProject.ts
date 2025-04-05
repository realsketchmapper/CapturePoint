import { useState, useCallback, useEffect } from 'react';
import { Project } from '@/types/project.types';
import { projectService } from '@/services/project/projectService';

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
    try {
      setLoading(true);
      setError(null);
      const data = await projectService.fetchProjects();
      setProjects(data);
    } catch (err) {
      setError('Error loading projects');
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch projects on component mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { projects, loading, error, fetchProjects };
}; 