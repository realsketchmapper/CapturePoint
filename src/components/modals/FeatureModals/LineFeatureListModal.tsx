import React, { useMemo, useCallback } from 'react';
import { StyleSheet, Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { MaterialIcons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { Colors } from '@/theme/colors';
import { FeatureType } from '@/types/featureType.types';

type GroupedFeatures = {
  [key: string]: FeatureType[];
}

interface LineFeatureListModalProps {
  isVisible: boolean;
  onClose: () => void;
  onFeatureSelect: (feature: FeatureType) => void;
}

export const LineFeatureListModal: React.FC<LineFeatureListModalProps> = React.memo(({ 
  isVisible, 
  onClose,
  onFeatureSelect
}) => {
  const { 
    expandedLayers, 
    toggleLayer,
    featureTypes: features,
    isLoading,
    error,
    featureTypesLoaded: featuresLoaded,
  } = useFeatureTypeContext();

  // Filter to only include line features
  const lineFeatures = useMemo(() => {
    return features.filter(feature => feature.type === 'Line');
  }, [features]);

  const groupedFeatures = useMemo<GroupedFeatures>(() => {
    console.log('Recalculating groupedFeatures for line features only');
    const groups = lineFeatures.reduce<GroupedFeatures>((acc: GroupedFeatures, feature: FeatureType) => {
      if (!acc[feature.draw_layer]) {
        acc[feature.draw_layer] = [];
      }
      acc[feature.draw_layer].push(feature);
      return acc;
    }, {});

    // Sort features within each group
    Object.keys(groups).forEach(layer => {
      groups[layer].sort((a: FeatureType, b: FeatureType) => a.name.localeCompare(b.name));
    });

    // Sort draw_layers alphabetically
    return Object.keys(groups)
      .sort()
      .reduce<GroupedFeatures>((acc: GroupedFeatures, key: string) => {
        acc[key] = groups[key];
        return acc;
      }, {});
  }, [lineFeatures]);

  const handleFeatureSelect = useCallback((feature: FeatureType) => {
    onFeatureSelect(feature);
    onClose();
  }, [onFeatureSelect, onClose]);

  // Function to render the appropriate image based on feature type
  const renderFeatureImage = useCallback((feature: FeatureType) => {
    // For line features with SVG data
    if (feature.type === 'Line' && feature.svg) {
      try {
        // Check if the SVG content is valid
        if (feature.svg.includes('<svg') && feature.svg.includes('</svg>')) {
          return (
            <SvgXml 
              xml={feature.svg} 
              width="100%" 
              height="100%" 
            />
          );
        } else {
          return <MaterialIcons name="broken-image" size={20} color={Colors.Yellow} />;
        }
      } catch (error) {
        return <MaterialIcons name="broken-image" size={20} color={Colors.BrightRed} />;
      }
    }
    // Fallback for features without images
    else {
      return <MaterialIcons name="linear-scale" size={20} color={Colors.LightBlue} />;
    }
  }, []);

  // Memoize the rendering of layers and features to prevent re-renders
  const renderFeatureGroups = useMemo(() => {
    return Object.entries(groupedFeatures).map(([layer, layerFeatures]) => (
      <View key={layer}>
        <TouchableOpacity 
          style={styles.layerHeader}
          onPress={() => toggleLayer(layer)}
        >
          {expandedLayers.has(layer) ? (
            <MaterialIcons name='arrow-drop-down' size={20} color="white" />
          ) : (
            <MaterialIcons name='keyboard-arrow-right' size={20} color="white" />
          )}
          <Text style={styles.layerTitle}>{layer}</Text>
        </TouchableOpacity>
        
        {expandedLayers.has(layer) && (
          <View style={styles.featureGroup}>
            {layerFeatures.map(feature => (
              <TouchableOpacity
                key={`${feature.name}-${feature.id}`}
                style={styles.featureItem}
                onPress={() => handleFeatureSelect(feature)}
              >
                <View style={styles.featureItemContent}>
                  <View style={styles.imageContainer}>
                    {renderFeatureImage(feature)}
                  </View>
                  <Text style={styles.featureName}>{feature.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    ));
  }, [groupedFeatures, expandedLayers, toggleLayer, handleFeatureSelect, renderFeatureImage]);

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
            <Text style={styles.title}>Select Line Feature to Collect</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          
          {isLoading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="white" />
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
          ) : lineFeatures.length === 0 ? (
            <View style={styles.centerContent}>
              <Text style={styles.errorText}>
                No line features available in this project.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.featureList}>
              {renderFeatureGroups}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.DarkBlue,
  },
  modalContent: {
    flex: 1,
    backgroundColor: Colors.DarkBlue,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'white',
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: Colors.BrightRed,
    fontSize: 16,
    textAlign: 'center',
  },
  featureList: {
    flex: 1,
  },
  layerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 8,
    borderRadius: 8,
  },
  layerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 10,
  },
  featureGroup: {
    marginLeft: 20,
  },
  featureItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    marginRight: 10,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    padding: 4,
  },
  featureImage: {
    width: '100%',
    height: '100%',
  },
  featureName: {
    fontSize: 16,
    color: 'white',
  }
}); 