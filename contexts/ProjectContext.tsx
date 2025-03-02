import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { Project } from '@/types/project.types';
import { ProjectContextType } from '@/types/project.types';

export const ProjectContext = createContext<ProjectContextType>({
  activeProject: null,
  setActiveProject: () => {},
});

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