import React, { useMemo, useCallback } from 'react';
import { StyleSheet, Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
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
  } = useFeatureTypeContext();

  console.log('FeatureListModal render:', {
    isVisible,
    featureTypesCount: featureTypes.length,
    featuresLoaded,
    isLoading,
    error,
    expandedLayersCount: expandedLayers.size
  });

  console.log('Available feature types:', featureTypes.map(ft => ({
    name: ft.name,
    type: ft.geometryType,
    layer: ft.draw_layer
  })));

  const groupedFeatures = useMemo<GroupedFeatures>(() => {
    console.log('Grouping features...');
    const groups = featureTypes.reduce<GroupedFeatures>((acc, featureType) => {
      if (!acc[featureType.draw_layer]) {
        acc[featureType.draw_layer] = [];
      }
      acc[featureType.draw_layer].push(featureType);
      return acc;
    }, {});

    console.log('Initial groups:', groups);

    Object.keys(groups).forEach(layer => {
      groups[layer].sort((a, b) => a.name.localeCompare(b.name));
    });

    const sortedGroups = Object.keys(groups)
      .sort()
      .reduce<GroupedFeatures>((acc, key) => {
        acc[key] = groups[key];
        return acc;
      }, {});

    console.log('Final grouped features:', sortedGroups);
    return sortedGroups;
  }, [featureTypes]);

  const handleFeatureSelect = useCallback((featureType: FeatureType) => {
    console.log('Feature selected:', featureType);
    setSelectedFeatureType(featureType);
    onClose();
  }, [setSelectedFeatureType, onClose]);

  const renderFeatureImage = useCallback((featureType: FeatureType) => {
    console.log('Rendering image for feature:', {
      name: featureType.name,
      geometryType: featureType.geometryType,
      hasImage: !!featureType.image_url,
      hasSvg: !!featureType.svg
    });

    if ((featureType.geometryType === 'Line' || 
         featureType.geometryType === 'Polygon') && featureType.svg) {
      try {
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
        console.error('Error rendering SVG:', error);
        return <MaterialIcons name="broken-image" size={20} color={Colors.BrightRed} />;
      }
    } 
    else if (featureType.geometryType === 'Point' && featureType.image_url) {
      return (
        <Image 
          source={{ uri: featureType.image_url }} 
          style={styles.featureImage} 
          resizeMode="contain"
        />
      );
    } 
    else {
      return <MaterialIcons name="image" size={20} color={Colors.LightBlue} />;
    }
  }, []);

  const renderFeatureGroups = useMemo(() => {
    console.log('Rendering feature groups. Groups:', Object.keys(groupedFeatures));
    console.log('Expanded layers:', Array.from(expandedLayers));
    
    return Object.entries(groupedFeatures).map(([layer, layerFeatures]) => {
      console.log(`Processing layer "${layer}" with ${layerFeatures.length} features`);
      
      return (
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
              {layerFeatures.map(featureType => {
                console.log(`Rendering feature: ${featureType.name}`);
                return (
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
                );
              })}
            </View>
          )}
        </View>
      );
    });
  }, [groupedFeatures, expandedLayers, toggleLayer, selectedFeatureType, handleFeatureSelect, renderFeatureImage]);

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.DarkBlue,
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    minHeight: 300,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: 'RobotoSlab-Bold',
    color: 'white',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'RobotoSlab-Regular',
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
    fontFamily: 'RobotoSlab-Regular',
  },
  featureList: {
    flex: 1,
    minHeight: 200,
  },
  layerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  layerTitle: {
    color: 'white',
    fontSize: 18,
    marginLeft: 8,
    fontFamily: 'RobotoSlab-Bold',
  },
  featureGroup: {
    paddingLeft: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  featureItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
  },
  selectedFeature: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureImage: {
    width: 24,
    height: 24,
  },
  featureName: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'RobotoSlab-Regular',
  },
});