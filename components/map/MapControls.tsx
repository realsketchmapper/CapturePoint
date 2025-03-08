// components/MapControls.tsx (simplified version)
import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  MapView,
  ShapeSource,
  CircleLayer,
  LineLayer,
  Camera,
  MapViewRef,
  CameraRef,
} from '@maplibre/maplibre-react-native';
import { RightSidebarContainer } from './RightSideBar/RightSidebarContainer';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { defaultMapStyle } from '@/services/maplibre/maplibre_helpers';
import FilteredPositionMarker from './FilteredPositionMarker';
import FeatureMarkers from './FeatureMarkers';
import { useFilteredPosition } from '@/hooks/useFilteredPosition';
import PointCollectionControls from '../collection/PointCollectionControls';

export const MapControls: React.FC = () => {
  const { features, isMapReady, setIsMapReady } = useMapContext();
  const { currentLocation } = useLocationContext();
  
  const mapRef = useRef<MapViewRef | null>(null);
  const cameraRef = useRef<CameraRef | null>(null);
  const [followGNSS, setFollowGNSS] = useState(true);
  const initialCenterDone = useRef<boolean>(false);
  
  // Get the filtered position from our hook
  const filteredPosition = useFilteredPosition(1); // 5 meters threshold
  
  const handleMapReady = () => {
    setIsMapReady(true);
  };

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

  // Position updates - using filtered position
  useEffect(() => {
    if (isMapReady && initialCenterDone.current && filteredPosition && followGNSS && cameraRef.current) {
      console.log("setting new position because filtered position changed");
      cameraRef.current.setCamera({
        centerCoordinate: filteredPosition,
        animationDuration: 300
      });
    }
  }, [filteredPosition, isMapReady, followGNSS]);

  // When user interacts with the map, temporarily stop following
  const handleRegionWillChange = (event?: any) => {
    if (event?.properties?.isUserInteraction) {
      setFollowGNSS(false);
      
      setTimeout(() => {
        setFollowGNSS(true);
      }, 5000); // 5-second delay
    }
  };

  return (
    <View style={mapStyles.mapContainer}>
      <MapView
        ref={mapRef}
        style={mapStyles.map}
        mapStyle={defaultMapStyle}
        onDidFinishLoadingMap={handleMapReady}
        onRegionWillChange={handleRegionWillChange}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: filteredPosition || [-122.4194, 37.7749],
            zoomLevel: 18,         
          }} 
        />

        {/* Only render marker if we have a filtered position */}
        {filteredPosition && (
          <FilteredPositionMarker 
            position={filteredPosition}
            color="#FF6B00"
            size={0.5}
          />
        )}

        <FeatureMarkers features={features.features} />

        <ShapeSource
          id="collectedData"
          shape={{
            type: 'FeatureCollection',
            features: features.features.filter(
              feature => !(feature.geometry.type === 'Point' && feature.properties?.featureId)
            )
          }}
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
      <PointCollectionControls />
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