import React, { createContext, useReducer, useCallback, useContext } from 'react';
import { Project, ProjectContextType } from '@/types/project.types';
import { projectService } from '@/services/project/projectService';

// Define action types
type ProjectAction = 
  | { type: 'SET_ACTIVE_PROJECT'; payload: Project | null }
  | { type: 'CLEAR_ACTIVE_PROJECT' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PROJECTS'; payload: Project[] };

// Define initial state
interface ProjectState {
  activeProject: Project | null;
  projects: Project[];
  error: string | null;
}

const initialState: ProjectState = {
  activeProject: null,
  projects: [],
  error: null
};

// Reducer function
function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'SET_ACTIVE_PROJECT':
      return { 
        ...state, 
        activeProject: action.payload,
        error: null // Clear any errors when setting a project
      };
    case 'CLEAR_ACTIVE_PROJECT':
      return { 
        ...state, 
        activeProject: null,
        error: null
      };
    case 'SET_ERROR':
      return { 
        ...state, 
        error: action.payload 
      };
    case 'SET_PROJECTS':
      return {
        ...state,
        projects: action.payload,
        error: null
      };
    default:
      return state;
  }
}

export const ProjectContext = createContext<ProjectContextType>({
  activeProject: null,
  projects: [],
  setActiveProject: () => {},
  fetchProjects: async () => {},
});

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  const setActiveProject = useCallback((project: Project | null) => {
    dispatch({ type: 'SET_ACTIVE_PROJECT', payload: project });
  }, []);

  const clearActiveProject = useCallback(() => {
    dispatch({ type: 'CLEAR_ACTIVE_PROJECT' });
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const projects = await projectService.fetchProjects();
      dispatch({ type: 'SET_PROJECTS', payload: projects });
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to fetch projects' 
      });
    }
  }, []);
  
  const value = {
    activeProject: state.activeProject,
    projects: state.projects,
    setActiveProject,
    clearActiveProject,
    fetchProjects,
    error: state.error
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

// Add this hook to access the ProjectContext
export const useProjectContext = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
};