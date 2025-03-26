// components/MapControls.tsx (simplified version)
import React, { useRef, useEffect, useState, useCallback } from 'react';
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
import { useSettingsContext } from '@/contexts/SettingsContext';
import { getMapStyle } from '@/services/maplibre/maplibre_helpers';
import FilteredPositionMarker from './FilteredPositionMarker';
import FeatureMarkers from './FeatureMarkers';
import MapPointDetails from '@/components/modals/PointModals/MapPointDetails';
import { storageService } from '@/services/storage/storageService';
import { PointCollected } from '@/types/pointCollected.types';
import { Feature, GeoJsonProperties, Geometry } from 'geojson';

export const MapControls: React.FC = () => {
  const { features, isMapReady, setIsMapReady } = useMapContext();
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
    console.log('Map clicked:', event);
    
    if (!mapRef.current) {
      console.log('No map ref');
      return;
    }

    try {
      // First check if we clicked on a custom marker point
      const customPoint = features.features.find(feature => {
        if (feature.geometry.type !== 'Point' || !feature.properties?.featureId) {
          return false;
        }
        
        const coords = feature.geometry.coordinates;
        const clickCoords = event.geometry.coordinates;
        
        // Check if click is within ~10 pixels of the point
        const distance = Math.sqrt(
          Math.pow(coords[0] - clickCoords[0], 2) + 
          Math.pow(coords[1] - clickCoords[1], 2)
        );
        
        return distance < 0.0001; // Roughly 10 meters at most zoom levels
      });

      if (customPoint) {
        console.log('Found custom point');
        try {
          const points = await storageService.getAllPoints();
          // Match by coordinates since IDs might be different
          const point = points.find(p => {
            if (customPoint.geometry.type !== 'Point') return false;
            const coords = customPoint.geometry.coordinates as [number, number];
            const coordsMatch = p.coordinates[0] === coords[0] &&
                              p.coordinates[1] === coords[1];
            return coordsMatch;
          });
          console.log('Matched point');
          
          if (point) {
            setSelectedPoint(point);
            setIsModalVisible(true);
          }
        } catch (error) {
          console.error('Error fetching custom point details:', error);
        }
        return;
      }

      // If no custom point found, check CircleLayer points
      const circleFeatures = await mapRef.current.queryRenderedFeaturesAtPoint(
        [event.properties.screenPointX, event.properties.screenPointY],
        undefined,
        ['collectedData']
      );
      
      console.log('Circle features found:', circleFeatures);

      // Find a regular point (not a location marker)
      const circlePoint = circleFeatures.features.find(f => 
        f.geometry.type === 'Point' && !f.properties?.isLocationMarker && !f.properties?.featureId
      );

      console.log('Circle point found:', circlePoint);

      if (circlePoint?.id) {
        try {
          const points = await storageService.getAllPoints();
          const point = points.find(p => p.id === circlePoint.id);
          
          if (point) {
            setSelectedPoint(point);
            setIsModalVisible(true);
          }
        } catch (error) {
          console.error('Error fetching circle point details:', error);
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
          <FilteredPositionMarker 
            position={currentLocation}
            color="#FF6B00"
            size={0.5}
            isLocationMarker={true}
          />
        )}

        <FeatureMarkers features={features.features} />

        <ShapeSource
          id="collectedData"
          shape={{
            type: 'FeatureCollection',
            features: features.features
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