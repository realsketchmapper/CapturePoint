import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { CurrentFeatureDisplayProps } from '@/types/currentFeatures.types';
import { Colors } from '@/theme/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';

export const CurrentFeatureDisplay: React.FC<CurrentFeatureDisplayProps> = ({
  style,
}) => {
  const { selectedFeatureType } = useFeatureTypeContext();

  // Function to render the appropriate image based on feature type
  const renderFeatureImage = useCallback(() => {
    if (!selectedFeatureType) return null;

    // For line or polygon type features with SVG data
    if ((selectedFeatureType.type === 'Line' || 
         selectedFeatureType.type === 'Polygon') && selectedFeatureType.svg) {
      try {
        // Check if the SVG content is valid
        if (selectedFeatureType.svg.includes('<svg') && selectedFeatureType.svg.includes('</svg>')) {
          return (
            <SvgXml 
              xml={selectedFeatureType.svg} 
              width={24} 
              height={24} 
            />
          );
        } else {
          return <MaterialIcons name="broken-image" size={24} color="orange" />;
        }
      } catch (error) {
        return <MaterialIcons name="broken-image" size={24} color="red" />;
      }
    } 
    // For point features with image URLs (PNGs)
    else if ((selectedFeatureType.type === 'Point') && selectedFeatureType.image_url) {
      return (
        <Image 
          source={{ uri: selectedFeatureType.image_url }} 
          style={styles.featureImage} 
          resizeMode="contain"
        />
      );
    } 
    // Fallback for features without images
    else {
      return <MaterialIcons name="image" size={24} color="#ccc" />;
    }
  }, [selectedFeatureType]);
  
  return (
    <View style={[styles.container, style]}>
      <View style={styles.imageContainer}>
        {renderFeatureImage()}
      </View>
      <Text style={styles.text}>
        {selectedFeatureType ?.name || 'Select a Feature'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  imageContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  featureImage: {
    width: 24,
    height: 24,
  },
  text: {
    color: Colors.DarkBlue,
    fontSize: 16,
    textAlign: 'left',
    fontFamily: 'RobotoSlab-Regular',
    flex: 1,
    paddingTop: 4,
    paddingLeft: 4
  }
});