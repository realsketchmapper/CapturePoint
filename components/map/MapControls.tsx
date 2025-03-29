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
import { storageService } from '@/services/storage/storageService';
import { PointCollected } from '@/types/pointCollected.types';
import { CollectedFeature } from '@/types/features.types';
import { Colors } from '@/theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/storage';


export const MapControls: React.FC = () => {
  const { features, isMapReady, setIsMapReady, refreshFeatures, clearFeatures } = useMapContext();
  const { currentLocation } = useLocationContext();
  const { settings } = useSettingsContext();
  const { activeProject } = useProjectContext();
  
  const mapRef = useRef<MapViewRef | null>(null);
  const cameraRef = useRef<CameraRef | null>(null);
  const [followGNSS, setFollowGNSS] = useState(true);
  const initialCenterDone = useRef<boolean>(false);
  const [isClearing, setIsClearing] = useState(false);
  
  // State for point details modal
  const [selectedPoint, setSelectedPoint] = useState<PointCollected | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  const handleMapReady = () => {
    setIsMapReady(true);
  };

  // Load features when map is ready
  useEffect(() => {
    if (isMapReady) {
      console.log('Map is ready, loading features...');
      refreshFeatures();
    }
  }, [isMapReady, refreshFeatures]);

  // Initial centering
  useEffect(() => {
    if (isMapReady && currentLocation && !initialCenterDone.current && cameraRef.current) {
      console.log("setting initial position");
      cameraRef.current.setCamera({
        centerCoordinate: currentLocation,
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
        centerCoordinate: currentLocation,
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

        console.log('Found closest feature:', closestFeature);

        if (!activeProject?.id) {
          console.log('No active project');
          return;
        }

        // Get features from storage
        const featuresKey = `${STORAGE_KEYS.PROJECT_FEATURES_PREFIX}${activeProject.id}`;
        const featuresJson = await AsyncStorage.getItem(featuresKey);
        if (!featuresJson) {
          console.log('No features found in storage');
          return;
        }

        const storedFeatures: CollectedFeature[] = JSON.parse(featuresJson);
        
        // Find the feature that contains this point
        let matchedPoint: PointCollected | null = null;
        for (const storedFeature of storedFeatures) {
          if (storedFeature.points) {
            matchedPoint = storedFeature.points.find((p: PointCollected) => 
              p.client_id === closestFeature?.properties?.client_id
            ) || null;
            
            if (matchedPoint) break;
          }
        }
        
        console.log('Matched point from storage:', matchedPoint);
        
        if (matchedPoint) {
          setSelectedPoint(matchedPoint);
          setIsModalVisible(true);
        } else {
          console.log('No matching point found in storage');
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

        // Get features from storage
        const featuresKey = `${STORAGE_KEYS.PROJECT_FEATURES_PREFIX}${activeProject.id}`;
        const featuresJson = await AsyncStorage.getItem(featuresKey);
        if (!featuresJson) {
          console.log('No features found in storage');
          return;
        }

        const storedFeatures: CollectedFeature[] = JSON.parse(featuresJson);
        
        // Find the feature that contains this point
        let matchedPoint: PointCollected | null = null;
        for (const storedFeature of storedFeatures) {
          if (storedFeature.points) {
            matchedPoint = storedFeature.points.find((p: PointCollected) => 
              p.client_id === clickedFeature?.properties?.client_id &&
              p.attributes?.featureTypeName === storedFeature.name
            ) || null;
            
            if (matchedPoint) break;
          }
        }
        
        console.log('Matched point from storage:', matchedPoint);
        
        if (matchedPoint) {
          setSelectedPoint(matchedPoint);
          setIsModalVisible(true);
        } else {
          console.log('No matching point found in storage');
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
      
      // Clear all points for the active project
      await storageService.clearAllPoints(activeProject.id);
      
      // Refresh the map
      refreshFeatures();
      
      console.log('=== Clear Storage Complete ===\n');
    } catch (error) {
      console.error('Error clearing storage:', error);
    } finally {
      setIsClearing(false);
    }
  };

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
            centerCoordinate: currentLocation || [-122.4194, 37.7749],
            zoomLevel: 18,         
          }} 
        />

        {currentLocation && (
          <CurrentPositionMarker 
            position={currentLocation}
            color="#FF6B00"
            size={0.8}
            isLocationMarker={true}
          />
        )}

        <FeatureMarkers features={features.features} />

        <ShapeSource
          id="collectedData"
          shape={features}
        >
          {/* Line layer for lines */}
          <LineLayer
            id="line-layer"
            sourceID="collectedData"
            filter={['==', ['get', 'type'], 'LineString']}
            style={{
              lineWidth: 3,
              lineColor: [
                'case',
                ['has', 'color', ['properties']],
                ['get', 'color', ['properties']],
                '#FF6B00' // Default to orange if no color property
              ],
              lineOpacity: 0.8,
            }}
          />

          {/* Circle layer for points */}
          <CircleLayer
            id="point-layer"
            sourceID="collectedData"
            filter={['==', ['get', 'type'], 'Point']}
            style={{
              circleRadius: 6,
              circleColor: [
                'case',
                ['has', 'color', ['properties']],
                ['get', 'color', ['properties']],
                '#FF6B00' // Default to orange if no color property
              ],
              circleOpacity: 0.8,
              circleStrokeWidth: 2,
              circleStrokeColor: '#FFFFFF',
              circleStrokeOpacity: 1
            }}
          />
        </ShapeSource>
      </MapView>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, isClearing && styles.buttonDisabled]}
          onPress={handleClearStorage}
          disabled={isClearing}
        >
          <Text style={styles.buttonText}>
            {isClearing ? 'Clearing...' : 'Clear Storage'}
          </Text>
        </TouchableOpacity>
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
});