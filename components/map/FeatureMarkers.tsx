import React, { useMemo, useEffect, useState } from 'react';
import { View, Image } from 'react-native';
import { MarkerView } from '@maplibre/maplibre-react-native';
import { useFeatureContext } from '@/FeatureContext';
import { CollectedFeature } from '@/types/features.types';
import { FeatureType } from '@/types/features.types';
import { storageService } from '@/services/storage/storageService';
import { useProjectContext } from '@/contexts/ProjectContext';

interface ExtendedFeatureMarkersProps {
  features: (CollectedFeature | GeoJSON.Feature)[];
}

const FeatureMarkers: React.FC<ExtendedFeatureMarkersProps> = React.memo(({ features }) => {
  const { activeProject } = useProjectContext();
  const [featureTypeMap, setFeatureTypeMap] = useState<Map<string, FeatureType>>(new Map());

  // Load feature types for the active project
  useEffect(() => {
    const loadFeatureTypes = async () => {
      if (!activeProject?.id) return;

      try {
        const featureTypes = await storageService.getFeatureTypes(activeProject.id);
        const map = new Map<string, FeatureType>();
        featureTypes.forEach(f => map.set(f.name, f));
        setFeatureTypeMap(map);
      } catch (error) {
        console.error('Error loading feature types:', error);
      }
    };

    loadFeatureTypes();
  }, [activeProject?.id]);

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
        if (!collectedFeature.points?.length || !collectedFeature.featureTypeName) {
          console.warn('Skipping invalid feature:', collectedFeature);
          return null;
        }

        // Get the feature type from our map
        const featureType = featureTypeMap.get(collectedFeature.featureTypeName);
        if (!featureType) {
          console.warn(`Feature type ${collectedFeature.featureTypeName} not found in map`);
          return null;
        }

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: collectedFeature.points[0].coordinates
          },
          properties: {
            client_id: collectedFeature.points[0].client_id,
            name: featureType.name,
            category: featureType.category,
            style: collectedFeature.attributes?.style || {},
            points: collectedFeature.points
          }
        };
      }
    }).filter(Boolean); // Remove null features

    // Filter for point features
    return convertedFeatures.filter(f => f?.geometry.type === 'Point');
  }, [features, featureTypeMap]);

  // Memoize the rendered markers
  const renderedMarkers = useMemo(() => {
    return pointFeatures.map(feature => {
      if (!feature) return null;
      
      const props = feature.properties || {};
      const coordinates = feature.geometry.type === 'Point' 
        ? (feature.geometry as GeoJSON.Point).coordinates as [number, number]
        : [0, 0];
      
      // Get the feature type from our map using the name
      const featureType = featureTypeMap.get(props.name);
      if (!featureType) {
        console.warn(`Feature type ${props.name} not found in map`);
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
              width: markerSize,
              height: markerSize,
              borderRadius: markerSize/2,
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
});

export default FeatureMarkers;

