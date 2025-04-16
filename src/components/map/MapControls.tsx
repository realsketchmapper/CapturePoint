// components/MapControls.tsx (simplified version)
import React, { useRef, useEffect, useState, useCallback, useContext } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import {
  MapView,
  ShapeSource,
  LineLayer,
  Camera,
  MapViewRef,
  CameraRef,
  CircleLayer,
} from '@maplibre/maplibre-react-native';
import { RightSidebarContainer } from './RightSideBar/RightSidebarContainer';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { getMapStyle } from '@/services/maplibre/maplibre_helpers';
import CurrentPositionMarker from './CurrentPositionMarker';
import FeatureMarkers from './FeatureMarkers';
import MapPointDetails from '@/components/modals/PointModals/MapPointDetails';
import { featureStorageService } from '@/services/storage/featureStorageService';
import { PointCollected } from '@/types/pointCollected.types';
import { CollectedFeature } from '@/types/currentFeatures.types';
import { Colors } from '@/theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/storage';
import { Position } from '@/types/collection.types';
import { FeatureToRender } from '@/types/featuresToRender.types';
import { Feature, Point } from 'geojson';
import { generateId } from '@/utils/collections';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';


// Helper function to convert Position to coordinates array
const positionToCoordinates = (position: Position): [number, number] => {
  if (Array.isArray(position)) {
    return position;
  }
  return [position.longitude, position.latitude];
};

export const MapControls: React.FC = () => {
  const { 
    features, 
    isMapReady, 
    setIsMapReady, 
    clearFeatures, 
    syncFeatures, 
    isSyncing, 
    error,
    addPoint,
    renderFeature,
    addFeature
  } = useMapContext();
  const { currentLocation } = useLocationContext();
  const { settings } = useSettingsContext();
  const { activeProject } = useProjectContext();
  const { featureTypes, getFeatureTypeByName } = useFeatureTypeContext();
  
  const mapRef = useRef<MapViewRef | null>(null);
  const cameraRef = useRef<CameraRef | null>(null);
  const [followGNSS, setFollowGNSS] = useState(true);
  const initialCenterDone = useRef<boolean>(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(false);
  const featuresLoadedRef = useRef<boolean>(false);
  const lastSyncTimeRef = useRef<number>(0);
  
  // State for point details modal
  const [selectedPoint, setSelectedPoint] = useState<PointCollected | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  const handleMapReady = () => {
    setIsMapReady(true);
  };

  // Initial centering
  useEffect(() => {
    if (isMapReady && currentLocation && !initialCenterDone.current && cameraRef.current) {
      console.log("setting initial position");
      cameraRef.current.setCamera({
        centerCoordinate: positionToCoordinates(currentLocation),
        zoomLevel: 18,
        animationDuration: 500,
      });
      initialCenterDone.current = true;
    }
  }, [isMapReady, currentLocation]);

  // Position updates
  useEffect(() => {
    if (isMapReady && initialCenterDone.current && currentLocation && followGNSS && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: positionToCoordinates(currentLocation),
        animationDuration: 300
      });
    }
  }, [currentLocation, isMapReady, followGNSS]);

  // When user interacts with the map, temporarily stop following
  const handleRegionWillChange = (event?: any) => {
    if (event?.properties?.isUserInteraction) {
      setFollowGNSS(false);
      
      setTimeout(() => {
        setFollowGNSS(true);
      }, 5000); // 5-second delay
    }
  };

  // Handle point click
  const handleMapClick = useCallback(async (event: any) => {
    try {
      console.log('\n=== Map Click Event ===');
      console.log('Click event:', event);

      // Get features at click point
      const queryResult = await mapRef.current?.queryRenderedFeaturesAtPoint(
        [event.properties.screenPointX, event.properties.screenPointY],
        undefined,
        ['point-features']
      ) || { features: [] };
      console.log('Query result:', queryResult);

      if (queryResult.features.length === 0) {
        console.log('No features found with queryRenderedFeaturesAtPoint, trying manual detection');
        
        // Get all point features from the map
        const pointFeatures = features.features.filter(f => 
          f.geometry.type === 'Point' && 
          f.properties?.client_id
        );

        // Find closest feature to click point
        const clickCoords = event.geometry.coordinates;
        let closestFeature = null;
        let minDistance = Infinity;

        for (const feature of pointFeatures) {
          const featureCoords = (feature.geometry as any).coordinates;
          console.log('Checking feature coordinates:', featureCoords);
          
          const distance = Math.sqrt(
            Math.pow(clickCoords[0] - featureCoords[0], 2) + 
            Math.pow(clickCoords[1] - featureCoords[1], 2)
          );
          console.log('Distance to feature:', distance);

          if (distance < minDistance && distance < 0.0001) { // About 11 meters at equator
            minDistance = distance;
            closestFeature = feature;
          }
        }

        if (!closestFeature) {
          console.log('No features found within click radius');
          return;
        }

        if (!activeProject?.id) {
          console.log('No active project');
          return;
        }

        // Get features from storage using the correct project-specific key
        const storageKey = `${STORAGE_KEYS.COLLECTED_FEATURES}_${activeProject.id}`;
        console.log('Fetching features with key:', storageKey);
        const featuresJson = await AsyncStorage.getItem(storageKey);
        if (!featuresJson) {
          console.log('No features found in storage');
          return;
        }

        const storedFeatures: CollectedFeature[] = JSON.parse(featuresJson);
        console.log('Features loaded from storage:', storedFeatures.length);
        
        // Find the point directly by client_id
        const matchedFeature = storedFeatures.find(f => 
          f.client_id === closestFeature?.properties?.client_id
        );
        
        console.log('Matched feature from storage:', matchedFeature);
        
        if (matchedFeature) {
          setSelectedPoint(matchedFeature.points[0]);
          setIsModalVisible(true);
        } else {
          console.log('No matching feature found in storage');
        }
      } else {
        // Process features found by queryRenderedFeaturesAtPoint
        console.log('Features found by queryRenderedFeaturesAtPoint:', queryResult.features);
        
        if (!activeProject?.id) {
          console.log('No active project');
          return;
        }

        // Get the clicked feature
        const clickedFeature = queryResult.features.find(f => 
          f.geometry.type === 'Point' && 
          f.properties?.client_id
        );

        if (!clickedFeature) {
          console.log('No point features found');
          return;
        }

        console.log('Selected feature:', clickedFeature);

        // Get features from storage using the correct project-specific key
        const storageKey = `${STORAGE_KEYS.COLLECTED_FEATURES}_${activeProject.id}`;
        console.log('Fetching features with key:', storageKey);
        const featuresJson = await AsyncStorage.getItem(storageKey);
        if (!featuresJson) {
          console.log('No features found in storage');
          return;
        }

        const storedFeatures: CollectedFeature[] = JSON.parse(featuresJson);
        console.log('Features loaded from storage:', storedFeatures.length);
        
        // Find the point directly by client_id
        const matchedFeature = storedFeatures.find(f => 
          f.client_id === clickedFeature?.properties?.client_id
        );
        
        console.log('Matched feature from storage:', matchedFeature);
        
        if (matchedFeature) {
          setSelectedPoint(matchedFeature.points[0]);
          setIsModalVisible(true);
        } else {
          console.log('No matching feature found in storage');
        }
      }
    } catch (error) {
      console.error('Error handling click:', error);
    }
  }, [features.features, activeProject?.id]);

  // Handle modal close
  const handleModalClose = () => {
    setIsModalVisible(false);
    setSelectedPoint(null);
  };

  const handleClearStorage = async () => {
    if (!activeProject?.id) {
      console.log('No active project to clear');
      return;
    }

    try {
      setIsClearing(true);
      console.log('\n=== Starting Clear Storage ===');
      
      // Clear all points
      await featureStorageService.clearProjectFeatures(activeProject.id);
      
      // Clear features from map
      clearFeatures();
      
      // Reset the features loaded flag
      featuresLoadedRef.current = false;
      
      console.log('=== Clear Storage Complete ===\n');
    } catch (error) {
      console.error('Error clearing storage:', error);
    } finally {
      setIsClearing(false);
    }
  };

  // Add function to load features from storage
  const loadFeaturesFromStorage = useCallback(async () => {
    // Prevent multiple calls
    if (isLoadingFeatures) {
      console.log('Already loading features, skipping');
      return;
    }
    
    try {
      setIsLoadingFeatures(true);
      console.log('=== Loading features from storage ===');
      if (!activeProject) {
        console.log('No active project, cannot load features');
        return;
      }

      const projectFeatures = await featureStorageService.getFeaturesForProject(activeProject.id);
      console.log('Features loaded from storage:', projectFeatures.length);

      // Clear existing features
      clearFeatures();

      // Add each point to the map
      for (const collectedFeature of projectFeatures) {
        if (!collectedFeature.points || collectedFeature.points.length === 0) {
          console.warn('Feature has no points:', collectedFeature.client_id);
          continue;
        }

        // Extract coordinates from NMEA data of the first point
        const point = collectedFeature.points[0];
        const longitude = point?.nmeaData?.gga?.longitude || 0;
        const latitude = point?.nmeaData?.gga?.latitude || 0;
        
        // Find the feature type by name
        const featureTypeName = collectedFeature.name;
        console.log('Looking for feature type by name:', featureTypeName);
        const featureType = getFeatureTypeByName(featureTypeName);
        
        if (!featureType) {
          console.warn(`Feature type "${featureTypeName}" not found in available types:`, featureTypes.map(f => f.name));
          continue;
        }
        
        // Create a feature for the map
        const feature: Feature = {
          type: 'Feature',
          id: collectedFeature.client_id,
          geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          properties: {
            type: 'Point',
            client_id: collectedFeature.client_id,
            name: collectedFeature.name,
            description: point?.description || '',
            feature_id: point?.feature_id || 0,
            featureType: featureType,
            draw_layer: collectedFeature.draw_layer,
            style: collectedFeature.attributes?.style || {},
            color: featureType.color
          }
        };
        
        // Add to map using addFeature
        console.log('Adding feature to map:', {
          name: feature.properties?.name,
          coordinates: (feature.geometry as Point).coordinates,
          featureType: feature.properties?.featureType?.name
        });
        addFeature(feature);
      }
      
      console.log('Features loaded and added to map');
      featuresLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading features from storage:', error);
    } finally {
      setIsLoadingFeatures(false);
    }
  }, [activeProject, clearFeatures, addFeature, getFeatureTypeByName, featureTypes, isLoadingFeatures]);

  // Single effect to handle initial feature loading
  useEffect(() => {
    // Only proceed if we have an active project and the map is ready
    if (!activeProject || !isMapReady) {
      return;
    }

    // Initial load - map is ready but features haven't been loaded yet
    if (!featuresLoadedRef.current && !isLoadingFeatures) {
      console.log('Initial feature load');
      loadFeaturesFromStorage();
    }
  }, [isMapReady, activeProject, loadFeaturesFromStorage, isLoadingFeatures]);

  // Add clear storage button component
  const ClearStorageButton = () => (
    <TouchableOpacity
      style={[
        styles.clearButton,
        isClearing && styles.buttonDisabled
      ]}
      onPress={handleClearStorage}
      disabled={isClearing}
    >
      <Text style={styles.buttonText}>
        {isClearing ? 'Clearing...' : 'Clear Storage'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        mapStyle={getMapStyle(settings.basemapStyle)}
        onPress={handleMapClick}
        onDidFinishLoadingMap={() => setIsMapReady(true)}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: currentLocation ? positionToCoordinates(currentLocation) : [-122.4194, 37.7749],
            zoomLevel: 18,         
          }} 
        />

        {currentLocation && (
          <CurrentPositionMarker 
            position={positionToCoordinates(currentLocation)}
            color="#FF6B00"
            size={0.8}
            isLocationMarker={true}
          />
        )}

        {/* Use FeatureMarkers for rendering features */}
        <FeatureMarkers features={features.features} />
      </MapView>
      
      <View style={styles.controlsContainer}>
        <ClearStorageButton />
      </View>

      <RightSidebarContainer />

      <MapPointDetails
        isVisible={isModalVisible}
        onClose={handleModalClose}
        point={selectedPoint}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  controlsContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1,
  },
  button: {
    backgroundColor: Colors.DarkBlue,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: Colors.DarkBlue,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    marginTop: 10,
  },
  loadButton: {
    backgroundColor: Colors.DarkBlue,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});