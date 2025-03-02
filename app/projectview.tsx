import React, { useContext, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ProjectList } from '../components/project/ProjectList';
import { useProjects } from '@/hooks/useProject';
import { Project } from '@/types/project.types';
import { ProjectContext } from '@/contexts/ProjectContext';
import { useFeatureContext } from '@/contexts/FeatureContext';

const ProjectView = () => {
  const { projects, loading, error, fetchProjects } = useProjects();
  const { setActiveProject, activeProject } = useContext(ProjectContext);
  const { fetchFeatures, clearFeatures } = useFeatureContext();

  const handleProjectPress = async (project: Project) => {
    try {
      console.log("loading project!");

      clearFeatures();

      setActiveProject(project);
      console.log("project id", project.id);
      

      await fetchFeatures(project.id);
      
      router.replace('../mapview');
    } catch (error) {
      console.error('Error loading project features:', error);
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