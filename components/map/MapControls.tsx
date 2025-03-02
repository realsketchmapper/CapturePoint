// MapControls.tsx (Updated)
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  MapView,
  ShapeSource,
  CircleLayer,
  LineLayer,
  Camera,
  MapViewRef
} from '@maplibre/maplibre-react-native';
import { RightSidebarContainer } from './RightSideBar/RightSidebarContainer';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { useCameraContext } from '@/contexts/CameraContext';
import { defaultMapStyle } from '@/services/maplibre/maplibre_helpers';
import GNSSPositionMarker from './GNSSPositionMarkerIcon';

export const MapControls: React.FC = () => {
  const {
    features,
    isMapReady,
    setIsMapReady
  } = useMapContext();

  const {
    currentLocation,
  } = useLocationContext();
  
  const {
    setCameraRef,
    setCamera,
    setBoundingBoxPercentage
  } = useCameraContext();

  const mapRef = useRef<MapViewRef | null>(null);
  const userInteractionRef = useRef<boolean>(false);
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Set bounding box to 70% of the visible map
  useEffect(() => {
    setBoundingBoxPercentage(70);
  }, [setBoundingBoxPercentage]);

  const handleMapReady = () => {
    setIsMapReady(true);
    setIsFirstLoad(true);
  };

  // Center map on current location when available and map is ready
  useEffect(() => {
    if (isMapReady && currentLocation && (isFirstLoad || !userInteractionRef.current)) {
      setCamera({
        centerCoordinate: currentLocation,
        zoomLevel: 18,
        animationDuration: 500
      });
      
      if (isFirstLoad) {
        setIsFirstLoad(false);
      }
    }
  }, [isMapReady, currentLocation, setCamera, isFirstLoad]);

  // Track when user is interacting with the map
  const handleRegionWillChange = () => {
    if (!userInteractionRef.current) {
      userInteractionRef.current = true;
      console.log("User started changing map region");
    }
    
    // Clear any existing timeout to prevent premature reset
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
      userInteractionTimeoutRef.current = null;
    }
  };

  const handleRegionDidChange = () => {
    // Only set a timeout if we're not already waiting for one
    if (userInteractionTimeoutRef.current === null) {
      userInteractionTimeoutRef.current = setTimeout(() => {
        if (userInteractionRef.current) {
          userInteractionRef.current = false;
          console.log("User finished changing map region");
        }
        userInteractionTimeoutRef.current = null;
      }, 2000); // Longer timeout to reduce frequency
    }
  };

  const handleMapPress = () => {
    userInteractionRef.current = true;
    
    // Clear existing timeout
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
    }
    
    // Set new timeout
    userInteractionTimeoutRef.current = setTimeout(() => {
      userInteractionRef.current = false;
      userInteractionTimeoutRef.current = null;
    }, 2000);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (userInteractionTimeoutRef.current) {
        clearTimeout(userInteractionTimeoutRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        mapStyle={defaultMapStyle}
        onDidFinishLoadingMap={handleMapReady}
        onRegionWillChange={handleRegionWillChange}
        onRegionDidChange={handleRegionDidChange}
        onPress={handleMapPress}
      >
        <Camera
          ref={setCameraRef}
          defaultSettings={{
            centerCoordinate: currentLocation || [-122.4194, 37.7749],
            zoomLevel: 18
          }}
        />

        {/* Use the simpler GNSS Position Marker */}
        <GNSSPositionMarker 
          color="#FF6B00"
          //size={1.2}
        />

        {/* Collected data source */}
        <ShapeSource
          id="collectedData"
          shape={features}
        >
          <CircleLayer
            id="pointLayer"
            filter={['==', ['geometry-type'], 'Point']}
            style={{
              circleRadius: 5,
              circleColor: '#007AFF',
              circleOpacity: 0.8,
              circleStrokeWidth: 2,
              circleStrokeColor: '#FFFFFF',
              circleStrokeOpacity: 0.5
            }}
          />
          <LineLayer
            id="lineLayer"
            filter={['==', ['geometry-type'], 'LineString']}
            style={{
              lineColor: '#007AFF',
              lineWidth: 3,
              lineOpacity: 0.8,
              lineCap: 'round',
              lineJoin: 'round'
            }}
          />
        </ShapeSource>
      </MapView>
      
      <RightSidebarContainer />
    </View>
  );
};

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});

export default MapControls;