import React, { useMemo } from 'react';
import { View, Image } from 'react-native';
import { MarkerView } from '@maplibre/maplibre-react-native';
import { FeatureMarkersProps } from '@/types/featureMarker.types';
import { useFeatureContext } from '@/FeatureContext';

const FeatureMarkers: React.FC<FeatureMarkersProps> = ({ features }) => {
  const { features: featureTypes } = useFeatureContext();
  
  // Memoize filtered features to prevent unnecessary re-renders
  const customPointFeatures = useMemo(() => 
    features.filter(feature => 
      feature.geometry.type === 'Point' && 
      (feature.properties?.featureId || feature.properties?.isLinePoint)
    ),
    [features]
  );

  // Create a map of feature types for faster lookup, using name as the key
  const featureTypeMap = useMemo(() => {
    const map = new Map();
    featureTypes.forEach(f => map.set(f.name.toLowerCase(), f));
    
    // Log once when feature types change
    console.log('Available feature types:', 
      featureTypes.map(f => ({ name: f.name, image_url: f.image_url }))
    );
    return map;
  }, [featureTypes]);

  // Log points once when they change
  React.useEffect(() => {
    console.log('Points to render:', customPointFeatures.map(f => ({
      id: f.id,
      name: f.properties?.name,
      isLinePoint: f.properties?.isLinePoint
    })));
  }, [customPointFeatures]);
  
  return (
    <>
      {customPointFeatures.map(feature => {
        const props = feature.properties || {};
        const coordinates = feature.geometry.type === 'Point' 
          ? (feature.geometry as GeoJSON.Point).coordinates as [number, number]
          : [0, 0];
        
        // Look up the feature type using the name
        const featureType = props.isLinePoint 
          ? null 
          : featureTypeMap.get(props.name?.toLowerCase());
        
        const isLinePoint = props.isLinePoint;
        const markerSize = isLinePoint ? 16 : 32;
        
        return (
          <MarkerView
            key={`marker-${feature.id}`}
            coordinate={coordinates}
            id={`marker-${feature.id}`}
          >
            {featureType?.image_url ? (
              <Image 
                source={{ uri: featureType.image_url }} 
                style={{ width: markerSize, height: markerSize }} 
                resizeMode="contain"
              />
            ) : (
              <View style={{
                width: isLinePoint ? 10 : 20,
                height: isLinePoint ? 10 : 20,
                borderRadius: isLinePoint ? 5 : 10,
                backgroundColor: isLinePoint ? '#000000' : '#007AFF',
                borderWidth: isLinePoint ? 1 : 2,
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