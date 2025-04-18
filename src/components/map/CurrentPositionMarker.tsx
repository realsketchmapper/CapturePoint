import React, { useMemo } from 'react';
import { ShapeSource, CircleLayer } from '@maplibre/maplibre-react-native';
import type { FeatureCollection } from 'geojson';

type CurrentPositionMarkerProps = {
  position: [number, number];
  color?: string;
  size?: number;
  isLocationMarker?: boolean;
};

const CurrentPositionMarker: React.FC<CurrentPositionMarkerProps> = ({
  position,
  color = '#FF6B00',
  size = .8,
  isLocationMarker = false
}) => {
  // Create GeoJSON feature for the position
  const positionFeature = useMemo((): FeatureCollection => {
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          isLocationMarker
        },
        geometry: {
          type: 'Point',
          coordinates: position
        }
      }]
    };
  }, [position, isLocationMarker]);

  // Use simple CircleLayers for visibility - creates a bullseye pattern
  return (
    <ShapeSource
      id="currentPositionSource"
      shape={positionFeature}
    >
      {/* White background circle for visibility */}
      <CircleLayer
        id="currentPositionMarkerBackground"
        style={{
          circleRadius: 12 * size,
          circleColor: 'white',
          circleOpacity: 0.8
        }}
      />
      
      {/* Colored ring */}
      <CircleLayer
        id="currentPositionMarkerRing"
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
        id="currentPositionMarkerInner"
        style={{
          circleRadius: 5 * size,
          circleColor: color,
          circleOpacity: 1
        }}
      />
    </ShapeSource>
  );
};

export default CurrentPositionMarker; 