import { ReactNode } from "react";

export interface Project {
    id: number;
    name: string;
    client_name: string;
    address: string;
    coords: [number, number];
    work_type: string;
    
    // Legacy format support properties - optional
    title?: string;        // Alternative to name
    client?: string;       // Alternative to client_name
    location?: string;     // Alternative to address
    coordinates?: [number, number] | { lat: number; lng: number } | { latitude: number; longitude: number };
    latitude?: number;     // Direct latitude value
    longitude?: number;    // Direct longitude value
    workType?: string;     // Alternative to work_type
    type?: string;         // Another alternative to work_type
}
  
export interface ProjectListProps {
  projects: Project[];
  onProjectPress: (project: Project) => void;
  onRefresh: () => void;
  loading: boolean;
  onClearProjectStorage?: () => void;
}

export interface ProjectListItemProps {
  project: Project;
  onPress: (project: Project) => void;
}

export interface ProjectsHeaderProps {
  onRefresh: () => void;
  loading: boolean;
  onClearProjectStorage?: () => void;
}

export interface ProjectNameDisplayProps {
  text?: string;
  style?: object;
}

export interface ProjectContextType {
  activeProject: Project | null;
  projects: Project[];
  isLoading: boolean;
  setActiveProject: (project: Project | null) => void;
  clearActiveProject?: () => void;
  fetchProjects: () => Promise<Project[]>;
  importLegacyProjects: () => Promise<Project[]>;
  error?: string | null;
}

export interface ProjectProviderProps {
  children: ReactNode;
}

export interface ProjectData {
  latitude: number;
  longitude: number;
  timestamp: string;
}