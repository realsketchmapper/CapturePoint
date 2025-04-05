import React, { useMemo, useCallback } from 'react';
import { StyleSheet, Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useFeatureContext } from '@/src/contexts/FeatureContext';
import { MaterialIcons } from '@expo/vector-icons';
import { Feature, FeatureListModalProps } from '@/types/features.types';
import { SvgXml } from 'react-native-svg';
import { Colors } from '@/src/theme/colors';

type GroupedFeatures = {
  [key: string]: Feature[];
}

export const FeatureListModal: React.FC<FeatureListModalProps> = React.memo(({ 
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
    featuresLoaded,
  } = useFeatureContext();

  const groupedFeatures = useMemo<GroupedFeatures>(() => {
    console.log('Recalculating groupedFeatures');
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

  const handleFeatureSelect = useCallback((feature: Feature) => {
    setSelectedFeature(feature);
    onClose();
  }, [setSelectedFeature, onClose]);

  // Function to render the appropriate image based on feature type
  const renderFeatureImage = useCallback((feature: Feature) => {
    // For line or polygon type features with SVG data
    if ((feature.type === 'Line' || 
         feature.type === 'Polygon') && feature.svg) {
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
    // For point features with image URLs (PNGs)
    else if ((feature.type === 'Point') && feature.image_url) {
      return (
        <Image 
          source={{ uri: feature.image_url }} 
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
                key={feature.id}
                style={[
                  styles.featureItem,
                  selectedFeature?.id === feature.id && styles.selectedFeature
                ]}
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
  }, [groupedFeatures, expandedLayers, toggleLayer, selectedFeature, handleFeatureSelect, renderFeatureImage]);

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
                No features loaded. Please select a project first.
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