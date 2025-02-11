import React, { createContext, useState, useCallback } from 'react';
import { Project } from '@/types/project.types';
import { projectService } from '@/services/projects/projectService';

interface ProjectContextType {
  activeProject: Project | null;
  setActiveProject: (project: Project) => void;
  clearActiveProject: () => void;
  projectData: any[]; // Replace with your specific data type
  addProjectData: (data: any) => void;
  saveProjectData: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectData, setProjectData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearActiveProject = useCallback(() => {
    setActiveProject(null);
    setProjectData([]);
    setError(null);
  }, []);

  const addProjectData = useCallback((data: any) => {
    setProjectData(prevData => [...prevData, { ...data, timestamp: new Date().toISOString() }]);
  }, []);

  const saveProjectData = useCallback(async () => {
    if (!activeProject) {
      setError('No project selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await projectService.saveProjectData(activeProject.id, projectData);
      setProjectData([]); // Clear after successful save
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project data');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeProject, projectData]);

  const value = {
    activeProject,
    setActiveProject,
    clearActiveProject,
    projectData,
    addProjectData,
    saveProjectData,
    loading,
    error
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};