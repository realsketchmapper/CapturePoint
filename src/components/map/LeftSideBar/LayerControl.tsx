import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { Colors } from '@/theme/colors';
import { MaterialIcons } from '@expo/vector-icons';

export const LayerControl: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { features, visibleLayers, setVisibleLayers, toggleLayer } = useMapContext();

  // Get unique layers from features
  const layers = React.useMemo(() => {
    const uniqueLayers = new Set<string>();
    features.features.forEach(feature => {
      const drawLayer = feature.properties?.draw_layer;
      if (drawLayer) {
        uniqueLayers.add(drawLayer);
      }
    });
    return Array.from(uniqueLayers);
  }, [features.features]);

  // Initialize layer visibility state
  useEffect(() => {
    const initialVisibility: Record<string, boolean> = {};
    layers.forEach(layer => {
      if (visibleLayers[layer] === undefined) {
        initialVisibility[layer] = true;
      }
    });
    if (Object.keys(initialVisibility).length > 0) {
      setVisibleLayers({
        ...visibleLayers,
        ...initialVisibility
      });
    }
  }, [layers]);

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