import React, { createContext, useReducer, useCallback, useContext } from 'react';
import { Project, ProjectContextType } from '@/types/project.types';

// Define action types
type ProjectAction = 
  | { type: 'SET_ACTIVE_PROJECT'; payload: Project | null }
  | { type: 'CLEAR_ACTIVE_PROJECT' }
  | { type: 'SET_ERROR'; payload: string | null };

// Define initial state
interface ProjectState {
  activeProject: Project | null;
  error: string | null;
}

const initialState: ProjectState = {
  activeProject: null,
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
    default:
      return state;
  }
}

export const ProjectContext = createContext<ProjectContextType>({
  activeProject: null,
  setActiveProject: () => {},
});

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  const setActiveProject = useCallback((project: Project | null) => {
    dispatch({ type: 'SET_ACTIVE_PROJECT', payload: project });
  }, []);

  const clearActiveProject = useCallback(() => {
    dispatch({ type: 'CLEAR_ACTIVE_PROJECT' });
  }, []);
  
  const value = {
    activeProject: state.activeProject,
    setActiveProject,
    clearActiveProject,
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