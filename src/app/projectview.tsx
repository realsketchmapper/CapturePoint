import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ProjectList } from '@/components/project/ProjectList';
import { useProjects } from '@/hooks/useProject';
import { Project } from '@/types/project.types';
import { ProjectContext } from '@/contexts/ProjectContext';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { calculateDistance, HALF_MILE_IN_METERS } from '@/utils/distance';
import { ProjectDistanceWarningModal } from '@/components/modals/ProjectModals/ProjectDistanceWarningModal';

const ProjectView = () => {
  const { projects, loading, error, fetchProjects } = useProjects();
  const { setActiveProject, activeProject } = useContext(ProjectContext);
  const { fetchFeatureTypes, clearFeatureTypes } = useFeatureTypeContext();
  const { currentLocation } = useLocationContext();
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [distance, setDistance] = useState(0);

  const calculateDistanceFromProject = (project: Project): number => {
    if (!currentLocation) return 0;
    
    const [currentLon, currentLat] = Array.isArray(currentLocation) 
      ? currentLocation 
      : [currentLocation.longitude, currentLocation.latitude];
    
    return calculateDistance(
      currentLat,
      currentLon,
      project.coords[1],  // latitude
      project.coords[0]   // longitude
    );
  };

  const handleProjectPress = async (project: Project) => {
    const dist = calculateDistanceFromProject(project);
    
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
      console.log('Opening project:', project.name);
      clearFeatureTypes();
      console.log('Cleared feature types');
      setActiveProject(project);
      console.log('Set active project');
      await fetchFeatureTypes(project.id);
      console.log('Fetched feature types');
      router.replace('/mapview');
      console.log('Navigating to mapview');
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