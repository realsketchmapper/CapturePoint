// components/MapControls.tsx (simplified version)
import React, { useRef, useEffect, useState, useCallback, useContext, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import {
  MapView,
  ShapeSource,
  Camera,
  MapViewRef,
  CameraRef,
  CircleLayer,
  LineLayer,
} from '@maplibre/maplibre-react-native';
import { RightSidebarContainer } from './RightSideBar/RightSidebarContainer';
import { LeftSidebarContainer } from './LeftSideBar/LeftSidebarContainer';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { getMapStyle } from '@/services/maplibre/maplibre_helpers';
import CurrentPositionMarker from './CurrentPositionMarker';
import FeatureMarkers from './FeatureMarkers';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import MapPointDetails from '@/components/modals/PointModals/MapPointDetails';
import { featureStorageService } from '@/services/storage/featureStorageService';
import { PointCollected } from '@/types/pointCollected.types';
import { CollectedFeature } from '@/types/currentFeatures.types';
import { Colors } from '@/theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/storage';
import { Position } from '@/types/collection.types';
import { FeatureToRender } from '@/types/featuresToRender.types';
import { Feature, Point, FeatureCollection, GeoJsonProperties } from 'geojson';
import { generateId } from '@/utils/collections';
import { LineCollectionManager } from './LineCollectionManager';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { FeatureType } from '@/types/featureType.types';
import { Coordinates } from '@/types/collection.types';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { getCurrentStandardizedTime } from '@/utils/datetime';
import { Coordinate } from '@/types/map.types';

// Helper function to convert Position to coordinates array
const positionToCoordinates = (position: Position): [number, number] => {
  if (Array.isArray(position)) {
    return position;
  }
  return [position.longitude, position.latitude];
};

// Component to render line features using MapLibre's LineLayer
interface LineFeatureRendererProps {
  features: any[];
}

const LineFeatureRenderer: React.FC<LineFeatureRendererProps> = React.memo(({ features }) => {
  const { visibleLayers } = useMapContext();
  
  // Filter features to only include lines and respect layer visibility
  const lineFeatures = useMemo(() => {
    return features.filter(feature => {
      // Must be a LineString
      if (feature.geometry?.type !== 'LineString') return false;
      
      // Check layer visibility
      const layer = feature.properties?.draw_layer;
      return layer ? visibleLayers[layer] !== false : true;
    });
  }, [features, visibleLayers]);
  
  // Create a GeoJSON FeatureCollection for the lines
  const lineFeatureCollection = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: lineFeatures
  }), [lineFeatures]);
  
  // Only render if we have line features
  if (lineFeatures.length === 0) {
    return null;
  }
  
  return (
    <ShapeSource 
      id="stored-lines-source"
      shape={lineFeatureCollection}
    >
      <LineLayer
        id="stored-lines-layer"
        style={{
          lineWidth: ['get', 'lineWidth', ['get', 'style']],
          lineOpacity: 1.0,
          lineColor: ['get', 'lineColor', ['get', 'style']],
        }}
      />
    </ShapeSource>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  if (prevProps.features.length !== nextProps.features.length) {
    return false; // Different lengths means we should re-render
  }
  
  // Compare feature IDs, coordinates, and styles to determine if we need to re-render
  return prevProps.features.every((prevFeature, index) => {
    const nextFeature = nextProps.features[index];
    return (
      prevFeature.id === nextFeature.id &&
      JSON.stringify(prevFeature.geometry.coordinates) === JSON.stringify(nextFeature.geometry.coordinates) &&
      JSON.stringify(prevFeature.properties?.style) === JSON.stringify(nextFeature.properties?.style)
    );
  });
});

export const MapControls: React.FC = () => {
  const { 
    features, 
    isMapReady, 
    setIsMapReady, 
    clearFeatures, 
    syncFeatures: syncFeaturesFromContext,
    isSyncing, 
    error,
    addPoint,
    renderFeature,
    addFeature,
    removeFeature,
    visibleLayers,
    addLine,
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
  
  // Collection context for adding points
  const { isCollecting, activeFeatureType, startCollection, recordPoint } = useCollectionContext();
  
  // Get the selected feature type
  const { selectedFeatureType } = useFeatureTypeContext();
  
  const { user } = useAuthContext();
  const { ggaData, gstData } = useNMEAContext();
  
  const handleMapReady = () => {
    setIsMapReady(true);
  };

  // Initial centering
  useEffect(() => {
    if (isMapReady && cameraRef.current) {
      if (currentLocation && !initialCenterDone.current) {
        console.log("setting initial position");
        cameraRef.current.setCamera({
          centerCoordinate: positionToCoordinates(currentLocation),
          zoomLevel: 18,
          animationDuration: 500,
        });
        initialCenterDone.current = true;
      } else if (!initialCenterDone.current) {
        // Set a default zoom level even without location
        console.log("setting default zoom level");
        cameraRef.current.setCamera({
          zoomLevel: 18,
          animationDuration: 500,
        });
        initialCenterDone.current = true;
      }
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

  // Handle map click
  const handleMapClick = useCallback(async (event: any) => {
    try {
      console.log('\n=== Map Click Event ===');
      console.log('Click event:', event);
      console.log('Properties:', event.properties);
      console.log('Features in event:', event.features?.length || 'none');
      
      // If we're collecting a line feature, ignore map clicks completely
      if (isCollecting && selectedFeatureType?.type === 'Line') {
        console.log('Ignoring map click during line collection');
        return;
      }

      if (!activeProject?.id) {
        console.log('No active project');
        return;
      }

      // Get all point features from the map using manual detection
      const pointFeatures = features.features.filter(f => 
        f.geometry.type === 'Point' && 
        f.properties?.client_id
      );

      // Find closest feature to click point
      const clickCoords = event.geometry.coordinates;
      let closestFeature = null;
      let minDistance = Infinity;

      // Increase the detection radius for easier clicking
      const CLICK_DETECTION_RADIUS = 0.00005; // About 5.5 meters at equator, increased from 0.00001

      for (const feature of pointFeatures) {
        const featureCoords = (feature.geometry as any).coordinates;
        console.log('Checking feature coordinates:', featureCoords);
        
        const distance = Math.sqrt(
          Math.pow(clickCoords[0] - featureCoords[0], 2) + 
          Math.pow(clickCoords[1] - featureCoords[1], 2)
        );
        console.log('Distance to feature:', distance);

        if (distance < minDistance && distance < CLICK_DETECTION_RADIUS) {
          minDistance = distance;
          closestFeature = feature;
        }
      }

      if (!closestFeature) {
        console.log('No features found within click radius');
        return;
      }

      console.log('Closest feature:', {
        id: closestFeature.id,
        clientId: closestFeature.properties?.client_id,
        isLinePoint: closestFeature.properties?.isLinePoint,
        parentLineId: closestFeature.properties?.parentLineId,
        properties: closestFeature.properties
      });

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
      
      const clientId = closestFeature?.properties?.client_id;
      const isLinePoint = closestFeature?.properties?.isLinePoint;
      const parentLineId = closestFeature?.properties?.parentLineId;
      
      // Look for either standalone point or line point
      let matchedPoint: PointCollected | null = null;
      
      if (isLinePoint && parentLineId) {
        // Find the parent line feature first
        const lineFeature = storedFeatures.find(f => f.client_id === parentLineId);
        if (lineFeature) {
          // Find the point within the line
          matchedPoint = lineFeature.points.find(p => p.client_id === clientId) || null;
          console.log('Found line point in parent line:', matchedPoint?.client_id);
        }
      } else {
        // Find standalone feature by client_id
        const matchedFeature = storedFeatures.find(f => f.client_id === clientId);
        if (matchedFeature && matchedFeature.points && matchedFeature.points.length > 0) {
          matchedPoint = matchedFeature.points[0];
          console.log('Found standalone point:', matchedPoint?.client_id);
        }
      }
      
      if (matchedPoint) {
        setSelectedPoint(matchedPoint);
        setIsModalVisible(true);
      } else {
        console.log('No matching point found in storage');
      }
    } catch (error) {
      console.error('Error handling click:', error);
    }
  }, [features, activeProject, isCollecting, selectedFeatureType, setSelectedPoint, setIsModalVisible]);

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

  // Modify the saveLineFeature function for line points
  const saveLineFeature = useCallback(async (
    points: Coordinates[],
    featureType: FeatureType,
    lineId: string,
    pointIds: string[]
  ) => {
    if (!activeProject || !user) {
      console.error('Cannot save line feature: missing project or user');
      return null;
    }

    try {
      const currentTime = getCurrentStandardizedTime();
      
      // Get existing features to determine line number
      const features = await featureStorageService.getFeaturesForProject(activeProject.id);
      
      // Count existing lines of this type
      const existingLinesOfType = features.filter(
        f => f.name === featureType.name && f.type === 'Line'
      ).length;
      
      // Generate a unique name with an incrementing number
      const lineName = `${featureType.name} ${existingLinesOfType + 1}`;
      
      // Create points for the line
      const linePoints = points.map((coord, i) => {
        const longitude = coord[0];
        const latitude = coord[1];
        
        if (typeof longitude !== 'number' || typeof latitude !== 'number') {
          console.warn('Invalid coordinates:', coord);
          return null;
        }
        
        const point: PointCollected = {
          client_id: pointIds[i],
          name: `${featureType.name} Point ${i + 1}`,
          description: `Point ${i + 1} of ${lineName}`,
          draw_layer: featureType.draw_layer,
          attributes: {
            nmeaData: {
              gga: ggaData ? {
                ...ggaData,
                longitude: longitude,
                latitude: latitude
              } : {
                time: currentTime,
                longitude: longitude,
                latitude: latitude,
                quality: 1,
                satellites: 10,
                hdop: 1.0,
                altitude: 0,
                altitudeUnit: 'm',
                geoidHeight: 0,
                geoidHeightUnit: 'm'
              },
              gst: gstData ? {
                ...gstData
              } : {
                time: currentTime,
                rmsTotal: 1.0,
                semiMajor: 1.0,
                semiMinor: 1.0,
                orientation: 0,
                latitudeError: 1.0,
                longitudeError: 1.0,
                heightError: 1.0
              }
            },
            featureTypeName: featureType.name,
            pointIndex: i,
            isLinePoint: true,
            parentLineId: lineId
          },
          created_by: String(user?.id || 'unknown'),
          created_at: currentTime,
          updated_at: currentTime,
          updated_by: String(user?.id || 'unknown'),
          synced: false,
          feature_id: 0,
          project_id: activeProject.id
        };
        return point;
      }).filter((point): point is PointCollected => point !== null);
      
      // Create a single line feature with all its points
      const lineFeature: CollectedFeature = {
        name: lineName,
        draw_layer: featureType.draw_layer,
        client_id: lineId,
        project_id: activeProject.id,
        type: 'Line',
        points: linePoints,
        attributes: {
          isLine: true,
          featureTypeName: featureType.name,
          lineColor: featureType.color,
          lineWeight: featureType.line_weight
        },
        is_active: true,
        created_by: Number(user?.id || 0),
        created_at: currentTime,
        updated_by: Number(user?.id || 0),
        updated_at: currentTime
      };
      
      // Save the line feature with all its points at once
      const existingFeatures = await featureStorageService.getFeaturesForProject(activeProject.id);
      await featureStorageService.saveFeatures(
        activeProject.id, 
        [...existingFeatures, lineFeature]
      );
      
      console.log('Line saved to storage with ID:', lineId, 'Points:', linePoints.length);
      return lineId;
    } catch (error) {
      console.error('Error saving line feature to storage:', error);
      return null;
    }
  }, [activeProject, user, ggaData, gstData]);

  // Update the loadFeaturesFromStorage function to handle line features
  const loadFeaturesFromStorage = useCallback(async () => {
    if (isLoadingFeatures) {
      return;
    }
    
    try {
      setIsLoadingFeatures(true);
      
      if (!activeProject) {
        return;
      }

      console.log('\n=== Starting Feature Load ===');
      
      // Clear existing features from the map first
      clearFeatures();
      
      const projectFeatures = await featureStorageService.getFeaturesForProject(activeProject.id);
      console.log(`Total features loaded from storage: ${projectFeatures.length}`);

      // Group line points by parentLineId for rendering as lines
      const lineFeatures = new Map<string, CollectedFeature>();
      const pointFeatures: CollectedFeature[] = [];
      
      // First, organize features into lines and regular points
      for (const feature of projectFeatures) {
        // Skip features with no points
        if (!feature.points || feature.points.length === 0) continue;
        
        // Check if this is a line feature by checking attributes
        if (feature.attributes?.isLine) {
          // Ensure we're not duplicating line features
          if (!lineFeatures.has(feature.client_id)) {
            lineFeatures.set(feature.client_id, feature);
            console.log(`\nFound line feature:
ID: ${feature.client_id}
Name: ${feature.name}
Points: ${feature.points.length}
Point IDs: ${feature.points.map(p => p.client_id).join(', ')}`);
          }
        } else if (!feature.points[0]?.attributes?.isLinePoint) {
          // Only add to pointFeatures if it's not a line point and not already added
          if (!pointFeatures.some(p => p.client_id === feature.client_id)) {
            pointFeatures.push(feature);
          }
        }
      }

      console.log(`\nTotal lines found: ${lineFeatures.size}`);
      console.log(`Total standalone points found: ${pointFeatures.length}`);

      // Process and render line features
      for (const lineFeature of lineFeatures.values()) {
        const featureType = getFeatureTypeByName(lineFeature.name);
        if (!featureType) continue;

        // Sort points by their index to ensure correct line order
        const sortedPoints = [...lineFeature.points].sort((a, b) => 
          (a.attributes?.pointIndex || 0) - (b.attributes?.pointIndex || 0)
        );

        console.log(`\nProcessing line ${lineFeature.client_id}:
Original point order: ${lineFeature.points.map(p => `${p.client_id} (index: ${p.attributes?.pointIndex})`).join(', ')}
Sorted point order: ${sortedPoints.map(p => `${p.client_id} (index: ${p.attributes?.pointIndex})`).join(', ')}`);

        // Create coordinates array for the line
        const coordinates: Coordinate[] = [];
        const validPoints: PointCollected[] = [];
        
        for (const point of sortedPoints) {
          const longitude = point.attributes?.nmeaData?.gga?.longitude;
          const latitude = point.attributes?.nmeaData?.gga?.latitude;
          if (typeof longitude === 'number' && typeof latitude === 'number') {
            coordinates.push([longitude, latitude]);
            validPoints.push(point);
          }
        }

        if (coordinates.length >= 2) {
          // Add the line feature using its stored ID
          addLine(coordinates, {
            client_id: lineFeature.client_id,
            name: lineFeature.name,
            featureType: featureType,
            draw_layer: lineFeature.draw_layer || featureType.draw_layer,
            style: {
              lineWidth: featureType.line_weight || 3,
              lineColor: featureType.color,
              lineOpacity: 1.0
            }
          });

          // Only render points that are explicitly marked as line points
          validPoints.forEach((point) => {
            if (!point.attributes?.isLinePoint) return;
            
            const longitude = point.attributes?.nmeaData?.gga?.longitude;
            const latitude = point.attributes?.nmeaData?.gga?.latitude;
            if (typeof longitude !== 'number' || typeof latitude !== 'number') return;
            
            // Get line point style from the LineCollectionManager component
            const linePointStyle = {
              circleRadius: 6,
              circleColor: featureType.color,
              circleOpacity: 0.9,
              circleStrokeWidth: 2,
              circleStrokeColor: 'white',
              circleStrokeOpacity: 0.8
            };

            // Use the exact point client_id that was saved
            console.log(`Adding point ${point.client_id} for line ${lineFeature.client_id}`);

            // Use the same point style as during collection
            addPoint([longitude, latitude], {
              client_id: point.client_id,
              name: point.name,
              featureType: featureType,
              draw_layer: point.draw_layer || featureType.draw_layer,
              isLinePoint: true,
              parentLineId: lineFeature.client_id,
              pointIndex: point.attributes?.pointIndex || 0,
              style: linePointStyle
            });
          });
        }
      }

      // Process and render standalone point features
      for (const pointFeature of pointFeatures) {
        const point = pointFeature.points[0];
        const longitude = point?.attributes?.nmeaData?.gga?.longitude;
        const latitude = point?.attributes?.nmeaData?.gga?.latitude;
        if (typeof longitude !== 'number' || typeof latitude !== 'number') continue;

        const featureType = getFeatureTypeByName(pointFeature.name);
        if (!featureType) continue;

        console.log(`Adding standalone point ${point.client_id}`);
        
        addPoint([longitude, latitude], {
          client_id: point.client_id,
          name: point.name,
          featureType: featureType,
          draw_layer: point.draw_layer || featureType.draw_layer,
          isLinePoint: false,
          parentLineId: undefined,
          style: {
            circleRadius: 6,
            circleColor: featureType.color,
            circleOpacity: 0.9,
            circleStrokeWidth: 2,
            circleStrokeColor: 'white',
            circleStrokeOpacity: 0.8
          }
        });
      }
    } catch (error) {
      console.error('Error loading features:', error);
    } finally {
      setIsLoadingFeatures(false);
    }
  }, [activeProject, clearFeatures, addFeature, addLine, addPoint, getFeatureTypeByName, featureTypes, isLoadingFeatures]);

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
      featuresLoadedRef.current = true;
    }
  }, [isMapReady, activeProject, loadFeaturesFromStorage, isLoadingFeatures]);

  // Memoize feature type lookup
  const memoizedGetFeatureTypeByName = useCallback((name: string) => {
    return getFeatureTypeByName(name);
  }, [getFeatureTypeByName, featureTypes]);

  // Memoize feature creation
  const createMapFeature = useCallback((collectedFeature: CollectedFeature, point: PointCollected, featureType: any) => {
    const longitude = point.attributes?.nmeaData?.gga?.longitude;
    const latitude = point.attributes?.nmeaData?.gga?.latitude;

    if (!longitude || !latitude) {
      console.warn('Invalid coordinates in feature:', collectedFeature.client_id);
      return null;
    }

    return {
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
        color: featureType.color,
        style: {
          circleColor: featureType.color,
          circleStrokeColor: featureType.color,
          circleRadius: 6,
          circleOpacity: 1,
          circleStrokeWidth: 2,
          circleStrokeOpacity: 1
        }
      }
    };
  }, []);

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

  const debugFeaturesWithDetails = useCallback(async () => {
    console.log('===== DETAILED FEATURE DEBUG =====');
    if (!activeProject) {
      console.log('No active project');
      return;
    }

    try {
      // Get features from storage
      const storedFeatures = await featureStorageService.getFeaturesForProject(activeProject.id);
      console.log(`Total features in storage: ${storedFeatures.length}`);
      
      // Log storage keys
      const storageKey = `${STORAGE_KEYS.COLLECTED_FEATURES}_${activeProject.id}`;
      console.log(`Storage key: ${storageKey}`);
      
      // Inspect each feature in detail
      console.log('=== Storage Features ===');
      for (const feature of storedFeatures) {
        console.log(`Feature ID: ${feature.client_id}, Type: ${feature.attributes?.featureTypeName || 'Unknown'}`);
        console.log(`  - Is Line: ${feature.attributes?.isLine ? 'Yes' : 'No'}`);
        console.log(`  - Points: ${feature.points?.length || 0}`);
        
        // If it's a line, check the points
        if (feature.attributes?.isLine) {
          if (feature.points && feature.points.length > 0) {
            // Check the first point to see if it has valid coordinates
            const firstPoint = feature.points[0];
            const coords = firstPoint.attributes?.nmeaData?.gga;
            console.log(`  - First point coords: ${coords ? `${coords.longitude}, ${coords.latitude}` : 'Missing'}`);
            
            // Check for issues
            if (!coords || coords.longitude === null || coords.latitude === null) {
              console.log('  - WARNING: Invalid coordinates in line points');
            }
          }
        }
      }
      
      // Log current map features
      console.log('=== Map Features ===');
      console.log(`Features on map: ${features.features.length}`);
      
      // Check the visible layers
      console.log('=== Visible Layers ===');
      console.log(visibleLayers);
      
    } catch (error) {
      console.error('Error in debug function:', error);
    }
    console.log('====================================');
  }, [activeProject, features, visibleLayers]);

  // Add debug button component
  const DebugDetailedButton = () => (
    <TouchableOpacity
      style={styles.debugButton}
      onPress={debugFeaturesWithDetails}
    >
      <Text style={styles.buttonText}>Debug Details</Text>
    </TouchableOpacity>
  );

  // Add a reload button component
  const ReloadButton = () => (
    <TouchableOpacity
      style={styles.reloadButton}
      onPress={loadFeaturesFromStorage}
    >
      <Text style={styles.buttonText}>Reload Features</Text>
    </TouchableOpacity>
  );

  // Handle direct feature click events
  const handleFeaturePress = useCallback(async (feature: any) => {
    console.log('Feature pressed:', feature);
    
    if (!feature || !activeProject?.id) {
      console.log('No feature or active project');
      return;
    }
    
    const clientId = feature.properties?.client_id;
    if (!clientId) {
      console.log('No client ID in feature');
      return;
    }
    
    const isLinePoint = feature.properties?.isLinePoint === true;
    const parentLineId = feature.properties?.parentLineId;
    
    try {
      // Get features from storage
      const storedFeatures = await featureStorageService.getFeaturesForProject(activeProject.id);
      console.log(`Looking for feature with client ID: ${clientId} in ${storedFeatures.length} features`);
      
      // Find the correct point in stored features
      let matchedPoint: PointCollected | null = null;
      
      if (isLinePoint && parentLineId) {
        // Find the parent line feature
        const lineFeature = storedFeatures.find(f => f.client_id === parentLineId);
        if (lineFeature) {
          // Find the specific point in the line
          matchedPoint = lineFeature.points.find(p => p.client_id === clientId) || null;
          console.log('Found line point in parent line:', matchedPoint?.client_id);
        }
      } else {
        // Find standalone feature
        const matchedFeature = storedFeatures.find(f => f.client_id === clientId);
        if (matchedFeature && matchedFeature.points && matchedFeature.points.length > 0) {
          matchedPoint = matchedFeature.points[0];
          console.log('Found standalone point:', matchedPoint?.client_id);
        }
      }
      
      if (matchedPoint) {
        setSelectedPoint(matchedPoint);
        setIsModalVisible(true);
      } else {
        console.log('No matching point found in storage');
      }
    } catch (error) {
      console.error('Error processing feature click:', error);
    }
  }, [activeProject, setSelectedPoint, setIsModalVisible]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        onDidFinishLoadingMap={handleMapReady}
        onRegionWillChange={handleRegionWillChange}
        onPress={handleMapClick}
        attributionEnabled={true}
        mapStyle={getMapStyle(settings.basemapStyle)}
      >
        <Camera
          ref={cameraRef}
          zoomLevel={18}
          animationDuration={500}
        />

        {/* Render current position marker */}
        {currentLocation && (
          <CurrentPositionMarker
            position={positionToCoordinates(currentLocation)}
            isLocationMarker={true}
          />
        )}

        {/* Render line features using direct LineLayer */}
        <LineFeatureRenderer features={features.features} />

        {/* Render standalone point features as images using FeatureMarkers */}
        <FeatureMarkers 
          features={features.features.filter(f => 
            f.geometry.type === 'Point' && 
            f.properties?.client_id &&
            (f.properties?.isLinePoint !== true || !f.properties?.parentLineId)
          )}
          onFeaturePress={handleFeaturePress}
        />

        {/* Render standalone point features as circles (fallback/legacy) */}
        <ShapeSource
          id="standalone-points-source"
          shape={{
            type: 'FeatureCollection',
            features: features.features.filter(f => 
              f.geometry.type === 'Point' && 
              f.properties?.client_id &&
              (f.properties?.isLinePoint !== true || !f.properties?.parentLineId) &&
              (!f.properties?.featureType?.image_url) // Only render points that don't have an image_url
            )
          }}
          onPress={(event) => {
            console.log('Feature pressed directly:', event.features[0].properties);
            handleFeaturePress(event.features[0]);
          }}
        >
          <CircleLayer
            id="standalone-points-layer"
            style={{
              circleRadius: ['get', 'circleRadius', ['get', 'style']],
              circleColor: ['get', 'circleColor', ['get', 'style']],
              circleOpacity: ['get', 'circleOpacity', ['get', 'style']],
              circleStrokeWidth: ['get', 'circleStrokeWidth', ['get', 'style']],
              circleStrokeColor: ['get', 'circleStrokeColor', ['get', 'style']],
              circleStrokeOpacity: ['get', 'circleStrokeOpacity', ['get', 'style']]
            }}
          />
        </ShapeSource>

        {/* Render line point features */}
        <ShapeSource
          id="line-points-source"
          shape={{
            type: 'FeatureCollection',
            features: features.features.filter(f => 
              f.geometry.type === 'Point' && 
              f.properties?.client_id &&
              f.properties?.isLinePoint === true &&
              f.properties?.parentLineId
            )
          }}
          onPress={(event) => {
            console.log('Line point pressed directly:', event.features[0].properties);
            handleFeaturePress(event.features[0]);
          }}
        >
          <CircleLayer
            id="line-points-layer"
            style={{
              circleRadius: ['get', 'circleRadius', ['get', 'style']],
              circleColor: ['get', 'circleColor', ['get', 'style']],
              circleOpacity: ['get', 'circleOpacity', ['get', 'style']],
              circleStrokeWidth: ['get', 'circleStrokeWidth', ['get', 'style']],
              circleStrokeColor: ['get', 'circleStrokeColor', ['get', 'style']],
              circleStrokeOpacity: ['get', 'circleStrokeOpacity', ['get', 'style']]
            }}
          />
        </ShapeSource>
        
        {/* Line Collection Manager */}
        <LineCollectionManager 
          onComplete={(points, lineId, pointIds) => {
            console.log('Line collection completed with points:', points.length);
            
            // Don't process lines with insufficient points
            if (points.length < 2) {
              console.warn('Cannot save line with fewer than 2 points');
              return;
            }
            
            // Save the line to storage and maintain visibility
            if (activeFeatureType && activeFeatureType.type === 'Line') {
              // First, save all points to storage
              saveLineFeature(points, activeFeatureType, lineId, pointIds)
                .then(storedLineId => {
                  if (storedLineId) {
                    console.log(`Line saved to storage with ID: ${storedLineId}`);
                    
                    // Keep the line and points visible while saving
                    // Add the line feature
                    addLine(points, {
                      client_id: lineId,
                      name: activeFeatureType.name,
                      featureType: activeFeatureType,
                      draw_layer: activeFeatureType.draw_layer,
                      style: {
                        lineWidth: activeFeatureType.line_weight || 3,
                        lineColor: activeFeatureType.color,
                        lineOpacity: 1.0
                      }
                    });

                    // Add each point
                    points.forEach((point, index) => {
                      addPoint(point, {
                        client_id: pointIds[index],
                        name: `${activeFeatureType.name} Point ${index + 1}`,
                        featureType: activeFeatureType,
                        draw_layer: activeFeatureType.draw_layer,
                        isLinePoint: true,
                        parentLineId: lineId,
                        pointIndex: index,
                        style: {
                          circleRadius: 6,
                          circleColor: activeFeatureType.color,
                          circleOpacity: 0.9,
                          circleStrokeWidth: 2,
                          circleStrokeColor: 'white',
                          circleStrokeOpacity: 0.8
                        }
                      });
                    });
                    
                    // After a short delay, reload all features to ensure consistency
                    setTimeout(() => {
                      loadFeaturesFromStorage();
                    }, 500);
                  } else {
                    console.error('Failed to save line to storage');
                  }
                })
                .catch(error => {
                  console.error('Error saving line:', error);
                });
            }
          }}
        />
      </MapView>
      
      <View style={styles.bottomControlsContainer}>
        <ReloadButton />
        <ClearStorageButton />
        <DebugDetailedButton />
      </View>

      <LeftSidebarContainer />
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
  bottomControlsContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
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
  debugButton: {
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
  reloadButton: {
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
});