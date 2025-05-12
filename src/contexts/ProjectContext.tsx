import React, { createContext, useReducer, useCallback, useContext, useEffect } from 'react';
import { Project } from '@/types/project.types';
import { projectService } from '@/services/project/projectService';
import { projectStorageService } from '@/services/storage/projectStorageService';

// Define the ProjectContext type locally
interface ProjectContextType {
  activeProject: Project | null;
  projects: Project[];
  isLoading: boolean;
  setActiveProject: (project: Project | null) => void;
  clearActiveProject?: () => void;
  fetchProjects: () => Promise<Project[]>;
  importLegacyProjects: () => Promise<Project[]>;
  error?: string | null;
}

// Define action types
type ProjectAction = 
  | { type: 'SET_ACTIVE_PROJECT'; payload: Project | null }
  | { type: 'CLEAR_ACTIVE_PROJECT' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'SET_LOADING'; payload: boolean };

// Define initial state
interface ProjectState {
  activeProject: Project | null;
  projects: Project[];
  error: string | null;
  isLoading: boolean;
}

const initialState: ProjectState = {
  activeProject: null,
  projects: [],
  error: null,
  isLoading: false
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
        error: action.payload,
        isLoading: false
      };
    case 'SET_PROJECTS':
      return {
        ...state,
        projects: action.payload,
        error: null,
        isLoading: false
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };
    default:
      return state;
  }
}

export const ProjectContext = createContext<ProjectContextType>({
  activeProject: null,
  projects: [],
  isLoading: false,
  setActiveProject: () => {},
  fetchProjects: async () => [],
  importLegacyProjects: async () => [],
});

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  // Initialize on mount - check for legacy projects
  useEffect(() => {
    const initializeProjects = async () => {
      console.log('ProjectProvider: Initializing projects');
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        
        // First try to import any legacy projects
        console.log('ProjectProvider: Looking for legacy projects during initialization');
        await importLegacyProjects();
        
        // Then fetch projects (which will include any newly imported ones)
        await fetchProjects();
      } catch (error) {
        console.error('Error initializing projects:', error);
        dispatch({ 
          type: 'SET_ERROR', 
          payload: error instanceof Error ? error.message : 'Failed to initialize projects' 
        });
      }
    };

    initializeProjects();
  }, []);

  const setActiveProject = useCallback((project: Project | null) => {
    dispatch({ type: 'SET_ACTIVE_PROJECT', payload: project });
  }, []);

  const clearActiveProject = useCallback(() => {
    dispatch({ type: 'CLEAR_ACTIVE_PROJECT' });
  }, []);

  const importLegacyProjects = useCallback(async () => {
    console.log('ProjectContext: Importing legacy projects');
    try {
      const importedProjects = await projectService.importLegacyProjects();
      
      if (importedProjects.length > 0) {
        console.log(`ProjectContext: Imported ${importedProjects.length} legacy projects`);
        // Update projects list after importing legacy projects
        await fetchProjects();
      } else {
        console.log('ProjectContext: No legacy projects found to import');
      }
      
      return importedProjects;
    } catch (error) {
      console.error('Error importing legacy projects:', error);
      return [];
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const projects = await projectService.fetchProjects();
      console.log(`ProjectContext: Fetched ${projects.length} projects`);
      
      if (projects.length > 0) {
        console.log('ProjectContext: Project IDs fetched:', projects.map(p => p.id).join(', '));
      } else {
        console.log('ProjectContext: No projects fetched');
      }
      
      dispatch({ type: 'SET_PROJECTS', payload: projects });
      return projects;
    } catch (error) {
      console.error('Error fetching projects:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to fetch projects' 
      });
      return [];
    }
  }, []);
  
  const value = {
    activeProject: state.activeProject,
    projects: state.projects,
    isLoading: state.isLoading,
    setActiveProject,
    clearActiveProject,
    fetchProjects,
    importLegacyProjects,
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