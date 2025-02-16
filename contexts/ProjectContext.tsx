import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { Project } from '@/types/project.types';
import { projectService } from '@/services/projects/projectService';

interface ProjectContextType {
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;
}

export const ProjectContext = createContext<ProjectContextType>({
  activeProject: null,
  setActiveProject: () => {},
});

interface ProjectProviderProps {
  children: ReactNode;
}

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearActiveProject = useCallback(() => {
    setActiveProject(null);
    setError(null);
  }, []);

  
  const value = {
    activeProject,
    setActiveProject,
    clearActiveProject,
    error
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};