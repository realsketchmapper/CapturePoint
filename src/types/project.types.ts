import { ReactNode } from "react";

export interface Project {
    id: number;
    name: string;
    client_name: string;
    address: string;
    coords: Array<number>;
    work_type: string;
  }
  
export interface ProjectListProps {
  projects: Project[];
  onProjectPress: (project: Project) => void;
  onRefresh: () => void;
  loading: boolean;
}

export interface ProjectListItemProps {
  project: Project;
  onPress: (project: Project) => void;
}

export interface ProjectsHeaderProps {
  onRefresh: () => void;
  loading: boolean;
}

export interface ProjectNameDisplayProps {
  text?: string;
  style?: object;
}

export interface ProjectContextType {
  activeProject: Project | null;
  projects: Project[];
  setActiveProject: (project: Project | null) => void;
  clearActiveProject: () => void;
  fetchProjects: () => Promise<void>;
  error: string | null;
}

export interface ProjectProviderProps {
  children: ReactNode;
}

export interface ProjectData {
  latitude: number;
  longitude: number;
  timestamp: string;
}