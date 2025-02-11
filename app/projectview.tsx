import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ProjectList } from '../components/project/ProjectList';
import { useProjects } from '@/hooks/useProject';
import { Project } from '@/types/project.types';

const ProjectView = () => {
  const { projects, loading, error, fetchProjects } = useProjects();

  const handleProjectPress = (project: Project) => {
    console.log("loading project!");
    router.replace('../mapview');
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ProjectList
      projects={projects}
      onProjectPress={handleProjectPress}
      onRefresh={fetchProjects}
      loading={loading}
    />
  );
};

export const styles = StyleSheet.create({
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: '#f5f5f5',
    },
    errorText: {
      color: '#FF0000',
      fontSize: 16,
      textAlign: 'center',
    },
  });
  
export default ProjectView;

