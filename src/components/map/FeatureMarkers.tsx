import React, { useMemo } from 'react';
import { View, Image } from 'react-native';
import { MarkerView } from '@maplibre/maplibre-react-native';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { CollectedFeature } from '@/types/currentFeatures.types';
import { FeatureType } from '@/types/featureType.types';
import { NMEAParser } from '@/services/gnss/nmeaParser';

interface ExtendedFeatureMarkersProps {
  features: any[];
}

const FeatureMarkers: React.FC<ExtendedFeatureMarkersProps> = React.memo(({ features }) => {
  const { featureTypes, getFeatureTypeByName } = useFeatureTypeContext();
  const { visibleLayers } = useMapContext();

  // Convert and filter features to points
  const pointFeatures = useMemo(() => {
    const filteredFeatures = features.map(feature => {
      if (!feature?.properties?.client_id) return null;

      const featureType = getFeatureTypeByName(feature.properties.name);
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
          color: featureType.color
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

      return (
        <MarkerView
          key={feature.properties.client_id}
          coordinate={feature.geometry.coordinates}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={{ alignItems: 'center' }}>
            {featureType.image_url ? (
              <Image
                source={{ uri: featureType.image_url }}
                style={{
                  width: 24,
                  height: 24,
                  tintColor: featureType.color
                }}
              />
            ) : (
              <View style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: featureType.color,
                borderWidth: 2,
                borderColor: 'white'
              }} />
            )}
          </View>
        </MarkerView>
      );
    });
  }, [visibleFeatures]);

  return <>{renderedMarkers}</>;
});

export default FeatureMarkers;

