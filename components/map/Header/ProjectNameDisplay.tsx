// src/components/ProjectNameDisplay.tsx
import React, { useContext }from 'react';
import { Text, StyleSheet } from 'react-native';
import { ProjectContext } from '@/contexts/ProjectContext';
import { ProjectNameDisplayProps } from '@/types/project.types';

export const ProjectNameDisplay: React.FC<ProjectNameDisplayProps> = ({
  style,
}) => {
    const { activeProject } = useContext(ProjectContext);

  return (
    <Text style={[styles.text, style]}>
      { activeProject?.name || 'No Project Selected'}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    color: 'white',
    fontSize: 16,
    textAlign: 'left',
    fontFamily: 'RobotoSlab-Regular',
    flex: 1,
    marginRight: 16,
    paddingTop: 10,
    paddingLeft: 4
  }
});