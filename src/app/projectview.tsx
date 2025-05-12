import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Button } from 'react-native';
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
import { projectStorageService } from '@/services/storage/projectStorageService';
import { featureTypeStorageService } from '@/services/storage/featureTypeStorageService';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/storage';

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
      
      // Check if we're online before trying to sync
      const networkState = await NetInfo.fetch();
      const isConnected = !!networkState.isConnected;
      
      if (isConnected) {
        // Initialize sync service for the project and wait for initial sync
        syncService.start(project.id);
        console.log('Initialized sync service');
        
        // Wait for initial sync to complete
        const syncResult = await syncService.syncProject(project.id);
        console.log('Initial sync completed:', syncResult);
      } else {
        console.log('Offline mode: Skipping sync process');
      }
      
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
          console.log(`Cleared features for project: ${project.name} (ID: ${project.id})`);
        }
        
        // Clear all stored projects data
        await projectStorageService.clearProjects();
        console.log('Cleared all stored projects data');
        
        // Clear all stored feature types
        await featureTypeStorageService.clearAllFeatureTypes();
        console.log('Cleared all stored feature types');
        
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

  useEffect(() => {
    // Debug: Test storage on component mount
    const testStorage = async () => {
      console.log('=== DEBUG: Testing project storage on component mount ===');
      try {
        await projectStorageService.debugVerifyStorage();
        const projects = await projectStorageService.getStoredProjects();
        console.log(`DEBUG: Found ${projects.length} projects in storage directly`);
        
        // List all AsyncStorage keys
        const allKeys = await AsyncStorage.getAllKeys();
        console.log('=== DEBUG: All AsyncStorage keys ===');
        console.log(allKeys.join('\n'));
        
        // Check content of each key related to projects
        const projectKeys = allKeys.filter(key => key.includes('project') || key === STORAGE_KEYS.PROJECTS);
        for (const key of projectKeys) {
          const value = await AsyncStorage.getItem(key);
          console.log(`Key: ${key} | Value: ${value ? (value.length > 100 ? value.substring(0, 100) + '...' : value) : 'null'}`);
        }
      } catch (error) {
        console.error('DEBUG: Error testing storage', error);
      }
    };
    
    testStorage();
  }, []);
  
  // Debug function to force refresh projects from storage
  const debugForceRefresh = async () => {
    console.log('=== DEBUG: Force refreshing projects from storage ===');
    try {
      setIsClearing(true); // Reuse loading state
      
      // List all keys first
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('All AsyncStorage keys:');
      console.log(allKeys.join('\n'));
      
      // Force refresh
      const projects = await projectStorageService.forceRefreshFromStorage();
      console.log(`Force refresh found ${projects.length} projects`);
      
      // If projects found, update state
      if (projects.length > 0) {
        await fetchProjects();
        Alert.alert('Debug', `Found ${projects.length} projects in storage`);
      } else {
        Alert.alert('Debug', 'No projects found in storage');
      }
    } catch (error) {
      console.error('DEBUG: Error in force refresh', error);
      Alert.alert('Debug Error', 'Error refreshing projects');
    } finally {
      setIsClearing(false);
    }
  };

  // Debug function to add test project to storage
  const debugAddTestProject = async () => {
    try {
      setIsClearing(true); // Reuse loading state
      
      // Create a test project
      const testProject: Project = {
        id: 9999,
        name: "Test Project",
        client_name: "Test Client",
        address: "123 Test Street",
        coords: [35.2271, -80.8431], // Charlotte, NC coordinates
        work_type: "Test Work"
      };
      
      // Get any existing projects
      const existingProjects = await projectStorageService.getStoredProjects();
      
      // Add test project if it doesn't exist
      if (!existingProjects.some(p => p.id === testProject.id)) {
        const updatedProjects = [...existingProjects, testProject];
        await projectStorageService.storeProjects(updatedProjects);
        console.log('Added test project to storage');
        
        // Refresh the projects list
        await fetchProjects();
        
        Alert.alert('Debug', 'Test project added successfully');
      } else {
        Alert.alert('Debug', 'Test project already exists');
      }
    } catch (error) {
      console.error('Error adding test project:', error);
      Alert.alert('Debug Error', 'Failed to add test project');
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

      {/* Debug buttons for development purposes */}
      {__DEV__ && (
        <View style={styles.debugButtonContainer}>
          <Button 
            title="Debug: Force Refresh" 
            onPress={debugForceRefresh} 
            color="#FF6347"
          />
          <View style={styles.buttonSpacer} />
          <Button 
            title="Debug: Add Test Project" 
            onPress={debugAddTestProject} 
            color="#4682B4"
          />
        </View>
      )}

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
  debugButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 10,
  },
  buttonSpacer: {
    width: 10,
  },
});

export default ProjectView; 