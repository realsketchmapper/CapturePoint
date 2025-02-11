import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';

export const MapControls: React.FC = () => {
  return (
    <View style={styles.mapContainer}>
      <MapLibreGL.MapView
        style={styles.map}
        mapStyle={{
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
        }}
      >
        <MapLibreGL.Camera
          defaultSettings={{
            centerCoordinate: [-122.4194, 37.7749],
            zoomLevel: 12
          }}
        />
      </MapLibreGL.MapView>
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