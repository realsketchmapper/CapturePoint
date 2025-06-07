import React, { useMemo } from 'react';
import { ShapeSource, CircleLayer } from '@maplibre/maplibre-react-native';
import type { FeatureCollection } from 'geojson';

interface SelectedPointIndicatorProps {
  coordinates: [number, number];
  color?: string;
  isVisible?: boolean;
}

const SelectedPointIndicator: React.FC<SelectedPointIndicatorProps> = ({
  coordinates,
  color = '#FF6B00',
  isVisible = true
}) => {
  // Create GeoJSON feature for the selected point indicator
  const indicatorFeature = useMemo((): FeatureCollection => {
    if (!isVisible) {
      return {
        type: 'FeatureCollection',
        features: []
      };
    }

    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          isSelectedIndicator: true
        },
        geometry: {
          type: 'Point',
          coordinates: coordinates
        }
      }]
    };
  }, [coordinates, isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <ShapeSource
      id="selectedPointIndicatorSource"
      shape={indicatorFeature}
    >
      {/* Outer pulsing circle */}
      <CircleLayer
        id="selectedPointIndicatorPulse"
        style={{
          circleRadius: 20,
          circleColor: color,
          circleOpacity: 0.2,
          circleStrokeWidth: 2,
          circleStrokeColor: color,
          circleStrokeOpacity: 0.4
        }}
      />
      
      {/* Middle ring */}
      <CircleLayer
        id="selectedPointIndicatorRing"
        style={{
          circleRadius: 15,
          circleColor: 'transparent',
          circleStrokeWidth: 3,
          circleStrokeColor: color,
          circleStrokeOpacity: 0.8
        }}
      />
      
      {/* Inner circle */}
      <CircleLayer
        id="selectedPointIndicatorInner"
        style={{
          circleRadius: 8,
          circleColor: color,
          circleOpacity: 0.6
        }}
      />
    </ShapeSource>
  );
};

export default SelectedPointIndicator; 