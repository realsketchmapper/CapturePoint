import React from 'react';
import { View, Image } from 'react-native';
import { MarkerView } from '@maplibre/maplibre-react-native';
import { SvgXml } from 'react-native-svg';
import { FeatureMarkersProps } from '@/types/featureMarker.types';

const FeatureMarkers: React.FC<FeatureMarkersProps> = ({ features }) => {
  // Filter out only point features with custom styling
  const customPointFeatures = features.filter(feature => 
    feature.geometry.type === 'Point' && 
    feature.properties?.featureId // Custom points will have featureId property
  );
  
  return (
    <>
      {customPointFeatures.map(feature => {
        const props = feature.properties || {};
        // Type assertion to access coordinates safely
        const coordinates = feature.geometry.type === 'Point' 
          ? (feature.geometry as GeoJSON.Point).coordinates as [number, number]
          : [0, 0]; // Fallback for non-point geometries
        
        return (
          <MarkerView
            key={`marker-${feature.id}`}
            coordinate={coordinates}
            id={`marker-${feature.id}`}
          >
            {props.imageUrl ? (
              <Image 
                source={{ uri: props.imageUrl }} 
                style={{ width: 32, height: 32 }} 
                resizeMode="contain"
              />
            ) : props.svg ? (
              <SvgXml 
                xml={props.svg} 
                width={32} 
                height={32} 
              />
            ) : (
              // Default marker if no image or SVG
              <View style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#007AFF',
                borderWidth: 2,
                borderColor: 'white',
              }} />
            )}
          </MarkerView>
        );
      })}
    </>
  );
};

export default FeatureMarkers;