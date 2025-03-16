import React from 'react';
import { TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { useFeatureContext } from '@/FeatureContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { Position } from '@/types/collection.types';
import { Colors } from '@/theme/colors';
import { useNMEAContext } from '@/contexts/NMEAContext';

const CollectionButton = () => {
  const { isCollecting, startCollection, stopCollection, saveCurrentPoint, currentPoints } = useCollectionContext();
  const { selectedFeature } = useFeatureContext();
  const { currentLocation, locationSource } = useLocationContext();
  const { ggaData, gstData } = useNMEAContext();
  const { addPoint, addLine, removeFeature } = useMapContext();

  // Don't render if not using NMEA
  if (locationSource !== 'nmea') {
    return null;
  }

  const handleCollect = async () => {
    if (!selectedFeature) {
      Alert.alert("No Feature Selected", "Please select a feature first.");
      return;
    }
    
    if (!currentLocation) {
      Alert.alert("No Position", "GNSS position not available.");
      return;
    }
    
    const featureType = selectedFeature.type;
    switch (featureType) {
      case 'Point':
        // Start collection and wait for it to complete
        const newState = startCollection(currentLocation, selectedFeature);
        if (!newState.isActive) {
          console.error('Failed to start collection');
          return;
        }
        
        // Add point to map
        const pointId = addPoint(currentLocation, {
          featureId: selectedFeature.id,
          name: selectedFeature.name,
          imageUrl: selectedFeature.image_url,
          svg: selectedFeature.svg,
          draw_layer: selectedFeature.draw_layer
        });
        
        if (!pointId) {
          console.error('Failed to add point to map');
          Alert.alert("Error", "Failed to create point. Please try again.");
          return;
        }
        
        // Try to save the point
        try {
          const success = await saveCurrentPoint({
            name: selectedFeature.name,
            featureType: selectedFeature.type,
            draw_layer: selectedFeature.draw_layer,
            pointId // This ID is required for map interactions
          }, newState);
          
          if (!success) {
            // If save failed, we should remove the point from the map since it wasn't saved
            removeFeature(pointId);
            console.error('Failed to save point');
            Alert.alert("Error", "Failed to save point. Please try again.");
          }
        } catch (error) {
          // Also remove the point from the map if there was an error
          removeFeature(pointId);
          console.error('Error saving point:', error);
          Alert.alert("Error", "An error occurred while saving the point.");
        } finally {
          stopCollection(); // Always stop collection for points
        }
        break;
        
      case 'Line':
      case 'Polygon':
        if (!isCollecting) {
          startCollection(currentLocation, selectedFeature);
        } else {
          stopCollection();
        }
        break;
        
      default:
        console.warn("Unsupported feature type:", featureType);
    }
  };
  
  return (
    <TouchableOpacity 
      style={styles.button}
      onPress={handleCollect}
      disabled={isCollecting && selectedFeature?.type === 'Point'}
    >
      <MaterialIcons
        name={isCollecting ? "stop" : "add-location"}
        size={24}
        color={Colors.DarkBlue}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    margin: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  }
});

export default CollectionButton;