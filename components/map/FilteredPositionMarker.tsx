// components/FilteredPositionMarker.tsx
import React, { useMemo } from 'react';
import { ShapeSource, CircleLayer } from '@maplibre/maplibre-react-native';
import type { FeatureCollection } from 'geojson';

type FilteredPositionMarkerProps = {
  position: [number, number];
  color?: string;
  size?: number;
};

const FilteredPositionMarker: React.FC<FilteredPositionMarkerProps> = ({
  position,
  color = '#FF6B00',
  size = 1.2
}) => {
  // Create GeoJSON feature for the position
  const positionFeature = useMemo((): FeatureCollection => {
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: position
        }
      }]
    };
  }, [position]);

  // Use simple CircleLayers for visibility - creates a bullseye pattern
  return (
    <ShapeSource
      id="filteredPositionSource"
      shape={positionFeature}
    >
      {/* White background circle for visibility */}
      <CircleLayer
        id="filteredPositionMarkerBackground"
        style={{
          circleRadius: 12 * size,
          circleColor: 'white',
          circleOpacity: 1
        }}
      />
      
      {/* Colored ring */}
      <CircleLayer
        id="filteredPositionMarkerRing"
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
        id="filteredPositionMarkerInner"
        style={{
          circleRadius: 5 * size,
          circleColor: color,
          circleOpacity: 1
        }}
      />
    </ShapeSource>
  );
};

export default FilteredPositionMarker;