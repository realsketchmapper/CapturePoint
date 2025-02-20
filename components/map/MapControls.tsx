import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import MapLibreGL, { CameraRef } from '@maplibre/maplibre-react-native';
import { RightSidebarContainer } from './RightSideBar/RightSidebarContainer';
import { useMapContext } from '@/contexts/MapDisplayContext';


const defaultMapStyle = {
  version: 8,
  sources: {
    'satellite-tiles': {
      type: 'raster',
      tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite-tiles',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

export const MapControls: React.FC = () => {
  const { features, setCamera, isMapReady, setIsMapReady } = useMapContext();
  const cameraRef = useRef<CameraRef>(null);
  const lastCoordinatesRef = useRef<string>('');

  const handleMapReady = () => {
    setIsMapReady(true);
    setCamera({
      centerCoordinate: [-122.4194, 37.7749],
      zoomLevel: 12,
      animationDuration: 0
    });
  };

  useEffect(() => {
    if (features.features.length > 0) {
      const latestFeature = features.features[features.features.length - 1];
      
      if (latestFeature.geometry.type === 'Point') {
        const coordinates = latestFeature.geometry.coordinates;
        const coordString = coordinates.join(',');

        // Only update if these are new coordinates
        if (coordString !== lastCoordinatesRef.current) {
          console.log("Moving camera to new coordinates:", coordinates);
          lastCoordinatesRef.current = coordString;
          
          if (cameraRef.current) {
            cameraRef.current.setCamera({
              centerCoordinate: coordinates,
              zoomLevel: 18,
              animationDuration: 500
            });
          }
        }
      }
    }
  }, [features]);

  return (
    <View style={styles.mapContainer}>
      <MapLibreGL.MapView
        style={styles.map}
        mapStyle={defaultMapStyle}
        onDidFinishLoadingMap={handleMapReady}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [-122.4194, 37.7749],
            zoomLevel: 12
          }}
        />
        <MapLibreGL.ShapeSource
          id="collectedData"
          shape={features}
        >
          {/* Point Layer */}
          <MapLibreGL.CircleLayer
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
          {/* Line Layer */}
          <MapLibreGL.LineLayer
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
        </MapLibreGL.ShapeSource>
      </MapLibreGL.MapView>
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