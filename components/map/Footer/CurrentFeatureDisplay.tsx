import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useFeatureContext } from '@/FeatureContext';
import { CurrentFeatureDisplayProps } from '@/types/currentFeatures.types';
import { Colors } from '@/theme/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';

export const CurrentFeatureDisplay: React.FC<CurrentFeatureDisplayProps> = ({
  style,
}) => {
  const { selectedFeature } = useFeatureContext();

  // Function to render the appropriate image based on feature type
  const renderFeatureImage = useCallback(() => {
    if (!selectedFeature) return null;

    // For line or polygon type features with SVG data
    if ((selectedFeature.type === 'Line' || 
         selectedFeature.type === 'Polygon') && selectedFeature.svg) {
      try {
        // Check if the SVG content is valid
        if (selectedFeature.svg.includes('<svg') && selectedFeature.svg.includes('</svg>')) {
          return (
            <SvgXml 
              xml={selectedFeature.svg} 
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
    else if ((selectedFeature.type === 'Point') && selectedFeature.image_url) {
      return (
        <Image 
          source={{ uri: selectedFeature.image_url }} 
          style={styles.featureImage} 
          resizeMode="contain"
        />
      );
    } 
    // Fallback for features without images
    else {
      return <MaterialIcons name="image" size={24} color="#ccc" />;
    }
  }, [selectedFeature]);
  
  return (
    <View style={[styles.container, style]}>
      <View style={styles.imageContainer}>
        {renderFeatureImage()}
      </View>
      <Text style={styles.text}>
        {selectedFeature?.name || 'Select a Feature'}
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