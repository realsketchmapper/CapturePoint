import React, { useContext, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ProjectList } from '../components/project/ProjectList';
import { useProjects } from '@/hooks/useProject';
import { Project } from '@/types/project.types';
import { ProjectContext } from '@/contexts/ProjectContext';
import { useFeature } from '@/hooks/useFeature';

const ProjectView = () => {
  const { projects, loading, error, fetchProjects } = useProjects();
  const { setActiveProject, activeProject } = useContext(ProjectContext);
  const { fetchFeatures, clearFeatures } = useFeature();

  const handleProjectPress = async (project: Project) => {
    try {
      console.log("loading project!");
      // Clear existing features first
      clearFeatures();
      
      // Set the active project
      setActiveProject(project);
      console.log("project id", project.id);
      
      // Fetch features for the selected project
      await fetchFeatures(project.id);
      
      // Navigate to map view after features are loaded
      router.replace('../mapview');
    } catch (error) {
      console.error('Error loading project features:', error);
      // You might want to show an error message to the user here
    }
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

const styles = StyleSheet.create({
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