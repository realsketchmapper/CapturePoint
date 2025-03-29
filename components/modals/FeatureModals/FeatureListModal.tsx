import React, { useMemo, useCallback } from 'react';
import { StyleSheet, Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useFeatureContext } from '@/FeatureContext';
import { MaterialIcons } from '@expo/vector-icons';
import { FeatureType } from '@/types/features.types';
import { SvgXml } from 'react-native-svg';
import { Colors } from '@/theme/colors';

interface FeatureListModalProps {
  isVisible: boolean;
  onClose: () => void;
}

type GroupedFeatures = {
  [key: string]: FeatureType[];
}

export const FeatureListModal: React.FC<FeatureListModalProps> = React.memo(({ 
  isVisible, 
  onClose
}) => {
  const { 
    selectedFeatureType, 
    setSelectedFeatureType, 
    expandedLayers, 
    toggleLayer,
    featureTypes,
    isLoading,
    error,
    featuresLoaded,
  } = useFeatureContext();

  const groupedFeatures = useMemo<GroupedFeatures>(() => {
    const groups = featureTypes.reduce<GroupedFeatures>((acc, featureType) => {
      if (!acc[featureType.draw_layer]) {
        acc[featureType.draw_layer] = [];
      }
      acc[featureType.draw_layer].push(featureType);
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
  }, [featureTypes]);

  const handleFeatureSelect = useCallback((featureType: FeatureType) => {
    setSelectedFeatureType(featureType);
    onClose();
  }, [setSelectedFeatureType, onClose]);

  // Function to render the appropriate image based on feature type
  const renderFeatureImage = useCallback((featureType: FeatureType) => {
    // For line or polygon type features with SVG data
    if ((featureType.geometryType === 'Line' || 
         featureType.geometryType === 'Polygon') && featureType.svg) {
      try {
        // Check if the SVG content is valid
        if (featureType.svg.includes('<svg') && featureType.svg.includes('</svg>')) {
          return (
            <SvgXml 
              xml={featureType.svg} 
              width={24} 
              height={24}
              style={{ transform: [{ scale: 0.8 }] }}
            />
          );
        } else {
          return <MaterialIcons name="broken-image" size={20} color={Colors.Yellow} />;
        }
      } catch (error) {
        return <MaterialIcons name="broken-image" size={20} color={Colors.BrightRed} />;
      }
    } 
    // For point features with image URLs (PNGs)
    else if (featureType.geometryType === 'Point' && featureType.image_url) {
      return (
        <Image 
          source={{ uri: featureType.image_url }} 
          style={styles.featureImage} 
          resizeMode="contain"
        />
      );
    } 
    // Fallback for features without images
    else {
      return <MaterialIcons name="image" size={20} color={Colors.LightBlue} />;
    }
  }, []);

  // Memoize the rendering of layers and features to prevent re-renders
  const renderFeatureGroups = useMemo(() => {
    return Object.entries(groupedFeatures).map(([layer, layerFeatures]) => (
      <View key={layer}>
        <TouchableOpacity 
          key={`layer-${layer}`}
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
            {layerFeatures.map(featureType => (
              <TouchableOpacity
                key={`${layer}-${featureType.name}`}
                style={[
                  styles.featureItem,
                  selectedFeatureType?.id === featureType.id && styles.selectedFeature
                ]}
                onPress={() => handleFeatureSelect(featureType)}
              >
                <View style={styles.featureItemContent}>
                  <View style={styles.imageContainer}>
                    {renderFeatureImage(featureType)}
                  </View>
                  <Text style={styles.featureName}>{featureType.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    ));
  }, [groupedFeatures, expandedLayers, toggleLayer, selectedFeatureType, handleFeatureSelect, renderFeatureImage]);

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
            <Text style={styles.title}>Select Feature Type</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
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
                No feature types loaded. Please select a project first.
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
  placeholderContainer: {
    marginRight: 10,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
  },
  selectedFeature: {
    backgroundColor: Colors.Aqua,
  },
  featureName: {
    fontSize: 14,
    color: 'white',
  },
});