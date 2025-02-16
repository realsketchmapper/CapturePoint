// src/components/ProjectNameDisplay.tsx
import React, { useContext }from 'react';
import { Text, StyleSheet } from 'react-native';
import { ProjectContext } from '@/contexts/ProjectContext';

interface ProjectNameDisplayProps {
  text?: string;
  style?: object;
}

export const ProjectNameDisplay: React.FC<ProjectNameDisplayProps> = ({
  text,
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