import React, { useMemo } from 'react';
import { StyleSheet, Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useFeature } from '@/hooks/useFeature';
import { MaterialIcons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { Feature } from '@/types/features.types';

interface FeatureListModalProps {
  isVisible: boolean;
  onClose: () => void;
}

type GroupedFeatures = {
  [key: string]: Feature[];
}

export const FeatureListModal: React.FC<FeatureListModalProps> = ({ 
  isVisible, 
  onClose
}) => {
  const { 
    selectedFeature, 
    setSelectedFeature, 
    expandedLayers, 
    toggleLayer,
    features,
    isLoading,
    error,
    featuresLoaded
  } = useFeature();

  const groupedFeatures = useMemo<GroupedFeatures>(() => {
    const groups = features.reduce<GroupedFeatures>((acc, feature) => {
      if (!acc[feature.draw_layer]) {
        acc[feature.draw_layer] = [];
      }
      acc[feature.draw_layer].push(feature);
      return acc;
    }, {});

    // Sort features within each group
    Object.keys(groups).forEach(layer => {
      groups[layer].sort((a, b) => a.name.localeCompare(b.name));
    });

    // Sort draw_layers alphabetically
    return Object.keys(groups)
      .sort()
      .reduce<GroupedFeatures>((acc, key) => {
        acc[key] = groups[key];
        return acc;
      }, {});
  }, [features]);

  const handleFeatureSelect = (feature: Feature) => {
    setSelectedFeature(feature);
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Feature</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text>Close</Text>
            </TouchableOpacity>
          </View>
          
          {isLoading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" />
            </View>
          ) : error ? (
            <View style={styles.centerContent}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : !featuresLoaded ? (
            <View style={styles.centerContent}>
              <Text style={styles.errorText}>
                No features loaded. Please select a project first.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.featureList}>
              {Object.entries(groupedFeatures).map(([layer, layerFeatures]) => (
                <View key={layer}>
                  <TouchableOpacity 
                    style={styles.layerHeader}
                    onPress={() => toggleLayer(layer)}
                  >
                    {expandedLayers.has(layer) ? (
                      <MaterialIcons name='arrow-drop-down' size={20} color="#000" />
                    ) : (
                      <MaterialIcons name='keyboard-arrow-right' size={20} color="#000" />
                    )}
                    <Text style={styles.layerTitle}>{layer}</Text>
                  </TouchableOpacity>
                  
                  {expandedLayers.has(layer) && (
                    <View style={styles.featureGroup}>
                      {layerFeatures.map(feature => (
                        <TouchableOpacity
                          key={feature.id}
                          style={[
                            styles.featureItem,
                            selectedFeature?.id === feature.id && styles.selectedFeature
                          ]}
                          onPress={() => handleFeatureSelect(feature)}
                        >
                          <View style={styles.featureItemContent}>
                            {feature.svg && (
                              <View style={styles.svgContainer}>
                                <SvgXml xml={feature.svg} width={24} height={24} />
                              </View>
                            )}
                            <Text style={styles.featureName}>{feature.name}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
  retryButton: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: '90%',
    height: '80%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 10,
  },
  featureList: {
    flex: 1,
  },
  layerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f0f0f0',
    marginVertical: 5,
    borderRadius: 5,
  },
  layerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  featureGroup: {
    marginLeft: 20,
  },
  featureItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  featureItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  svgContainer: {
    marginRight: 10,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedFeature: {
    backgroundColor: '#e6f3ff',
  },
  featureName: {
    fontSize: 14,
  },
});