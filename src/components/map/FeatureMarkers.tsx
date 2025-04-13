import React, { useMemo } from 'react';
import { View, Image } from 'react-native';
import { MarkerView } from '@maplibre/maplibre-react-native';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { CollectedFeature } from '@/types/currentFeatures.types';
import { FeatureType } from '@/types/featureType.types';
import { NMEAParser } from '@/services/gnss/nmeaParser';

interface ExtendedFeatureMarkersProps {
  features: (CollectedFeature | GeoJSON.Feature)[];
}

const FeatureMarkers: React.FC<ExtendedFeatureMarkersProps> = React.memo(({ features }) => {
  const { featureTypes, getFeatureTypeByName } = useFeatureTypeContext();

  // Convert and filter features to points
  const pointFeatures = useMemo(() => {
    console.log('=== FeatureMarkers Debug ===');
    console.log('Available feature types:', featureTypes.map(f => f.name));
    console.log('Input features:', features);

    const convertedFeatures = features.map(feature => {
      if ('geometry' in feature) {
        // It's already a GeoJSON Feature
        return feature;
      } else {
        // It's a CollectedFeature, convert to GeoJSON
        const collectedFeature = feature as CollectedFeature;
        
        // Skip if no points or invalid data
        if (!collectedFeature.points?.length) {
          console.warn('Skipping invalid feature:', collectedFeature);
          return null;
        }

        // Validate NMEA data
        const nmeaCoordinates = NMEAParser.ggaToMaplibreCoordinates(collectedFeature.points[0].nmeaData.gga);
        if (!nmeaCoordinates) {
          console.warn('Skipping feature with invalid NMEA data:', collectedFeature);
          return null;
        }

        // Get feature type using the new helper method
        const featureType = getFeatureTypeByName(collectedFeature.name);
        console.log(`Looking up feature type for "${collectedFeature.name}":`, featureType);
        
        if (!featureType) {
          console.warn(`Feature type "${collectedFeature.name}" not found in available types:`, featureTypes.map(f => f.name));
          return null;
        }

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: nmeaCoordinates
          },
          properties: {
            client_id: collectedFeature.client_id,
            name: collectedFeature.name,
            draw_layer: collectedFeature.draw_layer,
            style: collectedFeature.attributes?.style || {},
            featureType: featureType,
            points: collectedFeature.points
          }
        };
      }
    }).filter(Boolean);

    // Filter for point features
    const filteredFeatures = convertedFeatures.filter(f => f?.geometry.type === 'Point');
    console.log('Converted and filtered features:', filteredFeatures);
    return filteredFeatures;
  }, [features, getFeatureTypeByName, featureTypes]);

  // Memoize the rendered markers
  const renderedMarkers = useMemo(() => {
    return pointFeatures.map(feature => {
      if (!feature) return null;
      
      const props = feature.properties || {};
      const coordinates = feature.geometry.type === 'Point' 
        ? (feature.geometry as GeoJSON.Point).coordinates as [number, number]
        : [0, 0];
      
      // Get the feature type using the new helper method
      const featureType = getFeatureTypeByName(props.name);
      if (!featureType) {
        console.warn(`Feature type "${props.name}" not found in available types:`, featureTypes.map(f => f.name));
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
  }, [pointFeatures, getFeatureTypeByName, featureTypes]);

  return <>{renderedMarkers}</>;
});

export default FeatureMarkers;

