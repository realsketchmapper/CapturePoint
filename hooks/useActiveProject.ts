import { useContext } from 'react';
import { ProjectContext } from '@/contexts/ProjectContext';

export const useActiveProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useActiveProject must be used within a ProjectProvider');
  }
  return context;
};