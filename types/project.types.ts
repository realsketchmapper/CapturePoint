import { ReactNode } from "react";

export interface Project {
    id: number;
    name: string;
    client_name: string;
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
  setActiveProject: (project: Project | null) => void;
}

export interface ProjectProviderProps {
  children: ReactNode;
}