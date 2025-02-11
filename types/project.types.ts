export interface Project {
    id: number;
    name: string;
    address: string;
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