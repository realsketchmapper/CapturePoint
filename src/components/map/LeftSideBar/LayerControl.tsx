import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { Colors } from '@/theme/colors';
import { MaterialIcons } from '@expo/vector-icons';

export const LayerControl: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { features, visibleLayers, setVisibleLayers, toggleLayer } = useMapContext();

  // Get unique layers from features and ensure they're in visibleLayers
  const layers = React.useMemo(() => {
    const uniqueLayers = new Set<string>();
    features.features.forEach(feature => {
      const drawLayer = feature.properties?.draw_layer;
      if (drawLayer) {
        uniqueLayers.add(drawLayer);
      }
    });
    return Array.from(uniqueLayers);
  }, [features]);

  // Update visible layers whenever features change
  useEffect(() => {
    const newVisibleLayers = { ...visibleLayers };
    let needsUpdate = false;

    // Add any new layers that aren't in visibleLayers
    layers.forEach(layer => {
      if (newVisibleLayers[layer] === undefined) {
        newVisibleLayers[layer] = true;
        needsUpdate = true;
      }
    });

    // Remove any layers that no longer have features
    Object.keys(newVisibleLayers).forEach(layer => {
      if (!layers.includes(layer)) {
        delete newVisibleLayers[layer];
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      setVisibleLayers(newVisibleLayers);
    }
  }, [layers, visibleLayers, setVisibleLayers]);

  const handleToggleLayer = useCallback((layer: string) => {
    toggleLayer(layer);
  }, [toggleLayer]);

  const togglePanel = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={togglePanel}>
        <MaterialIcons name="layers" size={24} color={Colors.DarkBlue} />
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Layers</Text>
          <ScrollView style={styles.layerList}>
            {layers.map(layer => (
              <TouchableOpacity
                key={layer}
                style={styles.layerItem}
                onPress={() => handleToggleLayer(layer)}
              >
                <View style={styles.checkbox}>
                  {visibleLayers[layer] && (
                    <MaterialIcons name="check" size={20} color={Colors.DarkBlue} />
                  )}
                </View>
                <Text style={styles.layerName}>{layer}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
  },
  button: {
    backgroundColor: Colors.OffWhite,
    padding: 8,
    borderRadius: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  panel: {
    position: 'absolute',
    top: 50,
    left: 0,
    backgroundColor: Colors.OffWhite,
    borderRadius: 4,
    padding: 8,
    width: 200,
    maxHeight: 300,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: Colors.DarkBlue,
  },
  layerList: {
    maxHeight: 250,
  },
  layerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: Colors.DarkBlue,
    borderRadius: 4,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layerName: {
    fontSize: 14,
    color: Colors.DarkBlue,
  },
}); 