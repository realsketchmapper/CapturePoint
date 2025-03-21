import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ProjectList } from '../components/project/ProjectList';
import { useProjects } from '@/hooks/useProject';
import { Project } from '@/types/project.types';
import { ProjectContext } from '@/contexts/ProjectContext';
import { useFeatureContext } from '@/FeatureContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { calculateDistance, HALF_MILE_IN_METERS } from '@/utils/distance';
import { ProjectDistanceWarningModal } from '@/components/modals/ProjectModals/ProjectDistanceWarningModal';

const ProjectView = () => {
  const { projects, loading, error, fetchProjects } = useProjects();
  const { setActiveProject, activeProject } = useContext(ProjectContext);
  const { fetchFeatures, clearFeatures } = useFeatureContext();
  const { currentLocation } = useLocationContext();
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [distance, setDistance] = useState(0);

  const checkProjectDistance = (project: Project) => {
    if (!currentLocation || !project.coords || project.coords.length < 2) {
      return 0; // No distance check possible
    }

    return calculateDistance(
      currentLocation[1], // lat
      currentLocation[0], // lon
      project.coords[1],  // project lat
      project.coords[0]   // project lon
    );
  };

  const handleProjectPress = async (project: Project) => {
    const dist = checkProjectDistance(project);
    
    if (dist > HALF_MILE_IN_METERS) {
      setSelectedProject(project);
      setDistance(dist);
      setShowWarning(true);
    } else {
      await openProject(project);
    }
  };

  const openProject = async (project: Project) => {
    try {
      console.log('Opening project:', project.id);
      clearFeatures();
      setActiveProject(project);
      
    
      
      // Then fetch and sync with server
      console.log('Fetching server features...');
      await fetchFeatures(project.id);
      
      console.log('All features loaded, navigating to map view...');
      router.replace('../mapview');
    } catch (error) {
      console.error('Error loading project features:', error);
    }
  };

  const handleWarningCancel = () => {
    setShowWarning(false);
    setSelectedProject(null);
    setDistance(0);
  };

  const handleWarningContinue = async () => {
    if (selectedProject) {
      setShowWarning(false);
      await openProject(selectedProject);
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
    <>
      <ProjectList
        projects={projects}
        onProjectPress={handleProjectPress}
        onRefresh={fetchProjects}
        loading={loading}
      />

      <ProjectDistanceWarningModal
        isVisible={showWarning}
        onCancel={handleWarningCancel}
        onContinue={handleWarningContinue}
        distance={distance}
        projectName={selectedProject?.name || ''}
        projectAddress={selectedProject?.address || ''}
      />
    </>
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