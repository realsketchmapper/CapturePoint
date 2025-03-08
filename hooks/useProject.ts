import { useState, useCallback, useEffect } from 'react';
import { Project } from '@/types/project.types';
import { projectService } from '@/services/projects/projectService';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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


  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { projects, loading, error, fetchProjects };
};