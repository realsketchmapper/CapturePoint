import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ProjectList } from '../components/project/ProjectList';
import { useProjects } from '@/hooks/useProject';
import { Project } from '@/types/project.types';
import { ProjectContext } from '@/contexts/ProjectContext';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { calculateDistance, HALF_MILE_IN_METERS } from '@/utils/distance';
import { ProjectDistanceWarningModal } from '@/components/modals/ProjectModals/ProjectDistanceWarningModal';
import { storageService } from '@/services/storage/storageService';
import { useFeatureData } from '@/contexts/FeatureDataContext';
import { useModal } from '@/contexts/ModalContext';

const ProjectView = () => {
  const { projects, loading: projectsLoading, error, fetchProjects } = useProjects();
  const { setActiveProject } = useContext(ProjectContext);
  const { fetchFeatureTypes, clearFeatureTypes } = useFeatureTypeContext();
  const { currentLocation } = useLocationContext();
  const { loadFeatures, clearFeatures } = useFeatureData();
  const { loadUnsyncedCount } = useCollectionContext();
  const { showProjectWarningModal } = useModal();
  
  const [loading, setLoading] = useState(false);

  // Load projects when component mounts
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        console.log('Loading initial project data...');
        await fetchProjects();
        console.log('Projects loaded, checking unsynced items...');
        await loadUnsyncedCount();
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, [fetchProjects, loadUnsyncedCount]);

  const openProject = useCallback(async (project: Project) => {
    setLoading(true);
    try {
      console.log('Opening project:', project.id);
      
      // 1. Clear existing data
      try {
        console.log('Clearing existing data...');
        clearFeatureTypes();
        clearFeatures();
      } catch (error) {
        console.error('Error clearing data:', error);
        throw error;
      }
      
      // 2. Set active project
      try {
        console.log('Setting active project...');
        setActiveProject(project);
      } catch (error) {
        console.error('Error setting active project:', error);
        throw error;
      }
      
      // 3. Fetch feature types from server
      try {
        console.log('Fetching feature types...');
        await fetchFeatureTypes(project.id);
      } catch (error) {
        console.error('Error fetching feature types:', error);
        throw error;
      }
      
      // 4. Load features from storage
      try {
        console.log('Loading features...');
        await loadFeatures(project.id);
      } catch (error) {
        console.error('Error loading features:', error);
        throw error;
      }
      
      // 5. Navigate to map view
      console.log('All data loaded, navigating to map view...');
      router.push('/mapview');
    } catch (error) {
      console.error('Error in openProject:', error);
      setLoading(false);
      // Don't rethrow - we want to handle the error here
    }
  }, [clearFeatureTypes, clearFeatures, setActiveProject, fetchFeatureTypes, loadFeatures]);

  const checkProjectDistance = useCallback((project: Project) => {
    // If no current location or no project coords, allow the project to open
    if (!currentLocation || !project.coords || project.coords.length < 2) {
      console.log('Skipping distance check for project:', project.name, 
        !currentLocation ? '(no current location)' : '(no project coordinates)');
      return 0; // Allow project to open without warning
    }
    
    // Only calculate distance when we have both sets of coordinates
    return calculateDistance(
      currentLocation[1],
      currentLocation[0],
      project.coords[1],
      project.coords[0]
    );
  }, [currentLocation]);

  const handleProjectPress = useCallback(async (project: Project) => {
    try {
      console.log('Project pressed:', project.name);
      console.log('Project details:', {
        id: project.id,
        coords: project.coords,
        currentLocation
      });
      
      const dist = checkProjectDistance(project);
      console.log('Distance calculated:', dist);
      
      if (dist > HALF_MILE_IN_METERS) {
        console.log('Distance exceeds limit, showing warning');
        showProjectWarningModal({
          distance: dist,
          projectName: project.name,
          projectAddress: project.address || '',
          onCancel: () => {
            console.log('Warning cancelled');
          },
          onContinue: async () => {
            console.log('Warning continued, opening project:', project.name);
            await openProject(project);
          }
        });
      } else {
        console.log('Distance within limit, opening project');
        await openProject(project);
      }
    } catch (error) {
      console.error('Error in handleProjectPress:', error);
    }
  }, [checkProjectDistance, openProject, currentLocation, showProjectWarningModal]);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ProjectList
        projects={projects}
        onProjectPress={handleProjectPress}
        onRefresh={fetchProjects}
        loading={loading || projectsLoading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
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