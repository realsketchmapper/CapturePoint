// components/MapControls.tsx (simplified version)
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
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
import { getMapStyle } from '@/services/maplibre/maplibre_helpers';
import CurrentPositionMarker from './CurrentPositionMarker';
import FeatureMarkers from './FeatureMarkers';
import MapPointDetails from '@/components/modals/PointModals/MapPointDetails';
import { storageService } from '@/services/storage/storageService';
import { PointCollected } from '@/types/pointCollected.types';
import { Feature, GeoJsonProperties, Geometry, Point } from 'geojson';

export const MapControls: React.FC = () => {
  const { features, isMapReady, setIsMapReady, refreshFeatures } = useMapContext();
  const { currentLocation } = useLocationContext();
  const { settings } = useSettingsContext();
  
  const mapRef = useRef<MapViewRef | null>(null);
  const cameraRef = useRef<CameraRef | null>(null);
  const [followGNSS, setFollowGNSS] = useState(true);
  const initialCenterDone = useRef<boolean>(false);
  
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

  // Position updates - using current location directly
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
    console.log('\n=== Map Click Event ===');
    console.log('Click event:', event);
    
    if (!mapRef.current) {
      console.log('No map ref');
      return;
    }

    try {
      // Use MapLibre's built-in feature detection at the clicked point
      const queryResult = await mapRef.current.queryRenderedFeaturesAtPoint(
        [event.properties.screenPointX, event.properties.screenPointY],
        undefined,
        ['collectedData'] // Specify the source ID
      );
      
      console.log('Query result:', queryResult);
      
      if (!queryResult || !queryResult.features || queryResult.features.length === 0) {
        // If no features found with queryRenderedFeaturesAtPoint, try a different approach
        console.log('No features found with queryRenderedFeaturesAtPoint, trying manual detection');
        
        // Get click coordinates
        const clickCoords = event.geometry.coordinates;
        
        // Find features near the click point
        const pointFeatures = features.features.filter(feature => 
          feature.geometry.type === 'Point' &&
          (feature.properties?.featureId || feature.properties?.isLinePoint)
        );
        
        console.log('Available point features:', pointFeatures);
        
        // Find the closest point feature to the click
        let closestFeature = null;
        let minDistance = Number.MAX_VALUE;
        
        for (const feature of pointFeatures) {
          if (feature.geometry.type !== 'Point') continue;
          
          const coords = (feature.geometry as any).coordinates;
          console.log('Checking feature coordinates:', coords);
          
          if (!Array.isArray(coords) || coords.length < 2) {
            console.log('Invalid coordinates format:', coords);
            continue;
          }
          
          const distance = Math.sqrt(
            Math.pow(coords[0] - clickCoords[0], 2) + 
            Math.pow(coords[1] - clickCoords[1], 2)
          );
          
          console.log('Distance to feature:', distance);
          
          // Only consider points within a reasonable distance
          if (distance < 0.0002 && distance < minDistance) {
            minDistance = distance;
            closestFeature = feature;
          }
        }
        
        if (!closestFeature) {
          console.log('No features found near click point');
          return;
        }
        
        console.log('Found closest feature:', closestFeature);
        
        // Get all stored points
        const allStoredPoints = await storageService.getAllPoints();
        console.log(`Found ${allStoredPoints.length} stored points`);
        
        if (allStoredPoints.length === 0) {
          console.log('No points in storage to match against');
          return;
        }
        
        // Get feature coordinates
        const featureCoords = (closestFeature.geometry as any).coordinates as [number, number];
        
        // Find matching point in storage
        const matchedPoint = allStoredPoints.find(p => 
          Math.abs(p.coordinates[0] - featureCoords[0]) < 0.0000001 && 
          Math.abs(p.coordinates[1] - featureCoords[1]) < 0.0000001
        );
        
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
        
        // Find a point feature (prioritize line points)
        const clickedFeature = queryResult.features.find(f => 
          f.geometry.type === 'Point' && f.properties?.isLinePoint
        ) || queryResult.features.find(f => 
          f.geometry.type === 'Point' && f.properties?.featureId
        );
        
        if (!clickedFeature) {
          console.log('No point features found');
          return;
        }
        
        console.log('Selected feature:', clickedFeature);
        
        // Get all stored points
        const allStoredPoints = await storageService.getAllPoints();
        console.log(`Found ${allStoredPoints.length} stored points`);
        
        // Get feature properties
        const featureProps = clickedFeature.properties || {};
        const isLinePoint = featureProps.isLinePoint;
        const pointIndex = featureProps.pointIndex;
        const lineUniqueId = featureProps.lineUniqueId;
        
        console.log(`Selected ${isLinePoint ? 'line point' : 'regular point'} with index: ${pointIndex}, lineId: ${lineUniqueId}`);
        
        // Get feature coordinates
        const featureCoords = (clickedFeature.geometry as any).coordinates as [number, number];
        
        // Find matching point in storage
        let matchedPoint;
        
        if (isLinePoint) {
          // For line points, match by coordinates, pointIndex, and lineUniqueId if available
          matchedPoint = allStoredPoints.find(p => {
            // Check if it's a line point
            if (!p.properties?.isLinePoint) return false;
            
            // Check coordinates with small tolerance
            const coordsMatch = 
              Math.abs(p.coordinates[0] - featureCoords[0]) < 0.0000001 && 
              Math.abs(p.coordinates[1] - featureCoords[1]) < 0.0000001;
            
            // If we have lineUniqueId and pointIndex, use them for precise matching
            if (lineUniqueId && pointIndex !== undefined && 
                p.properties?.lineUniqueId && p.properties?.pointIndex !== undefined) {
              return coordsMatch && 
                     p.properties.lineUniqueId === lineUniqueId && 
                     p.properties.pointIndex === pointIndex;
            }
            
            // If we only have pointIndex, use that
            if (pointIndex !== undefined && p.properties?.pointIndex !== undefined) {
              return coordsMatch && p.properties.pointIndex === pointIndex;
            }
            
            return coordsMatch;
          });
        } else {
          // For regular points, match by coordinates
          matchedPoint = allStoredPoints.find(p => 
            Math.abs(p.coordinates[0] - featureCoords[0]) < 0.0000001 && 
            Math.abs(p.coordinates[1] - featureCoords[1]) < 0.0000001
          );
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
  }, [features.features]);

  // Handle modal close
  const handleModalClose = () => {
    setIsModalVisible(false);
    setSelectedPoint(null);
  };

  return (
    <View style={mapStyles.mapContainer}>
      <MapView
        ref={mapRef}
        style={mapStyles.map}
        mapStyle={getMapStyle(settings.basemapStyle)}
        onDidFinishLoadingMap={handleMapReady}
        onRegionWillChange={handleRegionWillChange}
        onPress={handleMapClick}
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
      
      <RightSidebarContainer />

      <MapPointDetails
        isVisible={isModalVisible}
        onClose={handleModalClose}
        point={selectedPoint}
      />
    </View>
  );
};

const mapStyles = StyleSheet.create({
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});