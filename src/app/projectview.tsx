import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { ProjectList } from '@/components/project/ProjectList';
import { useProjects } from '@/hooks/useProject';
import { Project } from '@/types/project.types';
import { ProjectContext } from '@/contexts/ProjectContext';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { calculateDistance, HALF_MILE_IN_METERS } from '@/utils/distance';
import { ProjectDistanceWarningModal } from '@/components/modals/ProjectModals/ProjectDistanceWarningModal';
import { syncService } from '@/services/sync/syncService';
import { featureStorageService } from '@/services/storage/featureStorageService';

const ProjectView = () => {
  const { projects, loading, error, fetchProjects } = useProjects();
  const { setActiveProject, activeProject } = useContext(ProjectContext);
  const { loadFeatureTypesForProject, clearFeatureTypes, featureTypesLoaded } = useFeatureTypeContext();
  const { currentLocation } = useLocationContext();
  const { resetCollectionState } = useCollectionContext();
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [distance, setDistance] = useState(0);
  const [isClearing, setIsClearing] = useState(false);

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
    // If project has no coordinates, open it directly
    if (!project.coords || project.coords.length < 2) {
      await openProject(project);
      return;
    }

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
      
      // Reset any active collection state and clear feature type selection
      resetCollectionState();
      console.log('Reset collection state');
      
      // Only clear feature types if switching to a different project
      if (activeProject?.id !== project.id) {
        clearFeatureTypes();
        console.log('Cleared feature types for new project');
      }
      
      // Set the active project
      setActiveProject(project);
      console.log('Set active project');
      
      // Initialize sync service for the project and wait for initial sync
      syncService.start(project.id);
      console.log('Initialized sync service');
      
      // Wait for initial sync to complete
      const syncResult = await syncService.syncProject(project.id);
      console.log('Initial sync completed:', syncResult);
      
      // Load feature types for the project
      await loadFeatureTypesForProject(project.id);
      console.log('Fetched feature types');
      
      // Navigate to map view
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

  const handleClearProjectStorage = async () => {
    if (isClearing) return;
    
    try {
      setIsClearing(true);
      console.log("=== Starting Clear All Project Storage ===");
      
      if (projects && projects.length > 0) {
        // Clear storage for each project
        for (const project of projects) {
          await featureStorageService.clearProjectFeatures(project.id);
          console.log(`Cleared storage for project: ${project.name} (ID: ${project.id})`);
        }
        
        Alert.alert(
          "Storage Cleared",
          "All project data has been cleared from local storage.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "No Projects",
          "No projects available to clear.",
          [{ text: "OK" }]
        );
      }
      
      console.log("=== Clear All Project Storage Complete ===");
    } catch (error) {
      console.error("Error clearing project storage:", error);
      Alert.alert(
        "Error",
        "An error occurred while clearing project storage.",
        [{ text: "OK" }]
      );
    } finally {
      setIsClearing(false);
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
        onClearProjectStorage={handleClearProjectStorage}
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