import React, { useMemo } from 'react';
import { View, Image } from 'react-native';
import { MarkerView } from '@maplibre/maplibre-react-native';
import { useFeatureContext } from '@/FeatureContext';
import { CollectedFeature } from '@/types/features.types';
import { FeatureType } from '@/types/features.types';

interface ExtendedFeatureMarkersProps {
  features: (CollectedFeature | GeoJSON.Feature)[];
}

const FeatureMarkers: React.FC<ExtendedFeatureMarkersProps> = React.memo(({ features }) => {
  const { featureTypes } = useFeatureContext();

  // Create a map of feature types for faster lookup
  const featureTypeMap = useMemo(() => {
    const map = new Map<number, FeatureType>();
    featureTypes.forEach(f => map.set(f.id, f));
    return map;
  }, [featureTypes]);

  // Convert and filter features to points
  const pointFeatures = useMemo(() => {
    const convertedFeatures = features.map(feature => {
      if ('geometry' in feature) {
        // It's already a GeoJSON Feature
        return feature;
      } else {
        // It's a CollectedFeature, convert to GeoJSON
        const collectedFeature = feature as CollectedFeature;
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: collectedFeature.points[0].coordinates
          },
          properties: {
            id: collectedFeature.id,
            featureTypeId: collectedFeature.featureTypeId,
            name: collectedFeature.featureType.name,
            category: collectedFeature.featureType.category,
            style: collectedFeature.attributes?.style,
            client_id: collectedFeature.client_id,
            points: collectedFeature.points
          }
        };
      }
    });

    // Filter for point features
    return convertedFeatures.filter(feature => 
      feature.geometry.type === 'Point'
    );
  }, [features]);

  // Memoize the rendered markers
  const renderedMarkers = useMemo(() => {
    return pointFeatures.map(feature => {
      const props = feature.properties || {};
      const coordinates = feature.geometry.type === 'Point' 
        ? (feature.geometry as GeoJSON.Point).coordinates as [number, number]
        : [0, 0];
      
      // Look up the feature type
      const featureType = featureTypeMap.get(props.featureTypeId);
      if (!featureType) return null;
      
      const markerSize = 32; // Standard size for all markers
      
      // Get the color from the feature type or style
      const color = props.style?.color || featureType.color;
      const formattedColor = color.startsWith('#') ? color : `#${color}`;
      
      return (
        <MarkerView
          key={`marker-${props.id}`}
          coordinate={coordinates}
          id={`marker-${props.id}`}
        >
          {featureType.image_url ? (
            <Image 
              source={{ uri: featureType.image_url }} 
              style={{ width: markerSize, height: markerSize }} 
              resizeMode="contain"
            />
          ) : (
            <View style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: formattedColor,
              borderWidth: 2,
              borderColor: 'white',
            }} />
          )}
        </MarkerView>
      );
    });
  }, [pointFeatures, featureTypeMap]);

  return <>{renderedMarkers}</>;
});export default FeatureMarkers;

