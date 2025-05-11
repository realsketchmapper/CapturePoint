import React, { useMemo } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import { MarkerView } from '@maplibre/maplibre-react-native';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { CollectedFeature } from '@/types/currentFeatures.types';
import { FeatureType } from '@/types/featureType.types';
import { NMEAParser } from '@/services/gnss/nmeaParser';

interface ExtendedFeatureMarkersProps {
  features: any[];
  onFeaturePress?: (feature: any) => void;
}

// Helper function to validate coordinates
const validateCoordinates = (coords: any): boolean => {
  if (!coords || !Array.isArray(coords) || coords.length !== 2) return false;
  
  const [lon, lat] = coords;
  return (
    typeof lon === 'number' && !isNaN(lon) && 
    typeof lat === 'number' && !isNaN(lat)
  );
};

const FeatureMarkers: React.FC<ExtendedFeatureMarkersProps> = React.memo(({ features, onFeaturePress }) => {
  const { featureTypes, getFeatureTypeByName } = useFeatureTypeContext();
  const { visibleLayers } = useMapContext();

  // Convert and filter features to points
  const pointFeatures = useMemo(() => {
    const filteredFeatures = features.map(feature => {
      if (!feature?.properties?.client_id) return null;
      if (!feature?.geometry?.coordinates) return null;
      
      // Validate coordinates
      if (!validateCoordinates(feature.geometry.coordinates)) {
        console.warn('Invalid coordinates in feature:', feature.properties.client_id, feature.geometry.coordinates);
        return null;
      }

      // For line points, use the featureType property directly if it's available,
      // otherwise fall back to looking up by name
      let featureType = feature.properties.featureType;
      
      // If featureType is not directly available, try to get it by name
      if (!featureType) {
        // Handle line points - extract the base feature type name
        // Typically names are like "Elec. Line Point 1", but the type is "Elec. Line"
        const name = feature.properties.name || '';
        let typeName = name;
        
        // Check if this is a line point and extract the base feature type
        if (name.includes(' Point ')) {
          const baseTypeName = name.split(' Point ')[0];
          if (baseTypeName) {
            typeName = baseTypeName;
          }
        }
        
        featureType = getFeatureTypeByName(typeName);
      }
      
      // Still couldn't find a feature type, skip this feature
      if (!featureType) return null;

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: feature.geometry.coordinates
        },
        properties: {
          client_id: feature.properties.client_id,
          name: feature.properties.name,
          description: feature.properties.description || '',
          feature_id: feature.properties.feature_id || 0,
          featureType: featureType,
          draw_layer: feature.properties.draw_layer,
          style: feature.properties.style || {},
          color: featureType.color || feature.properties.color,
          // Preserve all original properties for handling clicks
          ...feature.properties
        }
      };
    }).filter(Boolean);

    return filteredFeatures;
  }, [features, getFeatureTypeByName, featureTypes]);

  // Filter features based on layer visibility
  const visibleFeatures = useMemo(() => {
    return pointFeatures.filter(feature => {
      const layer = feature?.properties?.draw_layer;
      return layer ? visibleLayers[layer] !== false : true;
    });
  }, [pointFeatures, visibleLayers]);

  // Memoize the rendered markers
  const renderedMarkers = useMemo(() => {
    return visibleFeatures.map(feature => {
      if (!feature) return null;
      
      const featureType = feature.properties.featureType as FeatureType;
      if (!featureType) return null;
      
      // Extra validation before rendering the marker
      if (!validateCoordinates(feature.geometry.coordinates)) {
        console.warn('Invalid coordinates before rendering marker:', feature.properties.client_id);
        return null;
      }

      // Handle press event for this marker
      const handlePress = () => {
        console.log('Image marker pressed:', feature.properties.client_id);
        if (onFeaturePress) {
          // Ensure the feature has the format expected by the handler
          onFeaturePress({
            ...feature,
            id: feature.properties.client_id,
            properties: feature.properties
          });
        }
      };

      return (
        <MarkerView
          key={feature.properties.client_id}
          coordinate={feature.geometry.coordinates}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <TouchableOpacity 
            onPress={handlePress}
            style={{ alignItems: 'center' }}
          >
            {featureType.image_url ? (
              <Image
                source={{ uri: featureType.image_url }}
                style={{
                  width: 32,
                  height: 32
                }}
              />
            ) : (
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: featureType.color,
                borderWidth: 2,
                borderColor: 'white'
              }} />
            )}
          </TouchableOpacity>
        </MarkerView>
      );
    }).filter(Boolean); // Filter out null values
  }, [visibleFeatures, onFeaturePress]);

  return <>{renderedMarkers}</>;
});

export default FeatureMarkers;

