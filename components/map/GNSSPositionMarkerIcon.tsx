// GNSSPositionMarker.tsx
import React, { useMemo, useEffect } from 'react';
import { useLocationContext } from '@/contexts/LocationContext';
import { ShapeSource, CircleLayer } from '@maplibre/maplibre-react-native';
import type { FeatureCollection } from 'geojson';

interface GNSSPositionMarkerProps {
  color?: string;
  size?: number;
}

const GNSSPositionMarker: React.FC<GNSSPositionMarkerProps> = ({
  color = '#FF6B00',
  size = 1.2
}) => {
  const { currentLocation } = useLocationContext();

  // Create GeoJSON feature for the position
  const positionFeature = useMemo((): FeatureCollection => {
    if (!currentLocation) return {
      type: 'FeatureCollection',
      features: []
    };
    
    console.log("Creating position feature with location:", currentLocation);
    
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: currentLocation
        }
      }]
    };
  }, [currentLocation]);

  // Log the current location for debugging
  useEffect(() => {
    if (currentLocation) {
      console.log("GNSS Current Location:", currentLocation);
    }
  }, [currentLocation]);

  if (!currentLocation) {
    console.log("No current location available");
    return null;
  }

  // Use simple CircleLayers for visibility - creates a bullseye pattern
  return (
    <ShapeSource
      id="positionSource"
      shape={positionFeature}
    >
      {/* White background circle for visibility */}
      <CircleLayer
        id="positionMarkerBackground"
        style={{
          circleRadius: 12 * size,
          circleColor: 'white',
          circleOpacity: 1
        }}
      />
      
      {/* Colored ring */}
      <CircleLayer
        id="positionMarkerRing"
        style={{
          circleRadius: 10 * size,
          circleColor: 'white',
          circleStrokeWidth: 3 * size,
          circleStrokeColor: color,
          circleStrokeOpacity: 1
        }}
      />
      
      {/* Inner circle */}
      <CircleLayer
        id="positionMarkerInner"
        style={{
          circleRadius: 5 * size,
          circleColor: color,
          circleOpacity: 1
        }}
      />
    </ShapeSource>
  );
};

export default GNSSPositionMarker;