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
        
        // Skip if no points or invalid data
        if (!collectedFeature.points?.length || !collectedFeature.featureType) {
          console.warn('Skipping invalid feature:', collectedFeature);
          return null;
        }

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: collectedFeature.points[0].coordinates
          },
          properties: {
            id: collectedFeature.id || 0,
            client_id: collectedFeature.points[0].client_id,
            featureTypeId: collectedFeature.featureTypeId,
            name: collectedFeature.featureType?.name || 'Unknown',
            category: collectedFeature.featureType?.category || '',
            style: collectedFeature.attributes?.style || {},
            points: collectedFeature.points
          }
        };
      }
    }).filter(Boolean); // Remove null features

    // Filter for point features
    return convertedFeatures.filter(f => f?.geometry.type === 'Point');
  }, [features]);

  // Memoize the rendered markers
  const renderedMarkers = useMemo(() => {
    return pointFeatures.map(feature => {
      if (!feature) return null;
      
      const props = feature.properties || {};
      const coordinates = feature.geometry.type === 'Point' 
        ? (feature.geometry as GeoJSON.Point).coordinates as [number, number]
        : [0, 0];
      
      // Look up the feature type
      const featureType = featureTypeMap.get(props.featureTypeId);
      if (!featureType) {
        console.warn('Feature type not found:', props.featureTypeId);
        return null;
      }
      
      const markerSize = 32; // Standard size for all markers
      
      // Get the color from the feature type or style
      const color = props.style?.color || featureType.color || '#FF6B00';
      const formattedColor = color.startsWith('#') ? color : `#${color}`;
      
      return (
        <MarkerView
          key={`marker-${props.client_id}`}
          coordinate={coordinates}
          id={`marker-${props.client_id}`}
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

