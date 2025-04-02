import { useState, useCallback, useMemo } from 'react';
import { Project } from '@/types/project.types';
import { projectService } from '@/services/projects/projectService';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await projectService.fetchProjects();
      // Sort projects by name for consistent order
      const sortedData = [...data].sort((a, b) => a.name.localeCompare(b.name));
      console.log('Sorted projects:', sortedData.map(p => p.name));
      setProjects(sortedData);
    } catch (err) {
      setError('Error loading projects');
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Return a memoized value to ensure stable references
  return useMemo(() => ({
    projects,
    loading,
    error,
    fetchProjects
  }), [projects, loading, error, fetchProjects]);
};