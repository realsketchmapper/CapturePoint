import React from 'react';
import { Button, View, StyleSheet, Text, Alert } from 'react-native';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { useFeatureContext } from '@/FeatureContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { Position } from '@/types/collection.types';

const CollectionButton = () => {
  const { isCollecting, startCollection, stopCollection, saveCurrentPoint } = useCollectionContext();
  const { selectedFeature } = useFeatureContext();
  const { currentLocation } = useLocationContext();
  const { addPoint, addLine } = useMapContext(); // add line later

  const handleCollect = () => {
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
        if (currentLocation) {
          const [longitude, latitude] = currentLocation;
          const positionObject: Position = { longitude, latitude };
          
          // Start collection
          startCollection(positionObject, selectedFeature);
          
          // Add to map
          addPoint(currentLocation, {
            featureId: selectedFeature.id,
            name: selectedFeature.name,
            imageUrl: selectedFeature.image_url,
            svg: selectedFeature.svg,
            draw_layer: selectedFeature.draw_layer
          });
          
          // Save BEFORE stopping collection
          console.log('Saving point to storage via CollectionContext');
          saveCurrentPoint({
            name: selectedFeature.name,
            imageUrl: selectedFeature.image_url,
            draw_layer: selectedFeature.draw_layer
          }).then(success => {
            console.log('Point save result:', success);
            
            // Stop collection AFTER saving
            //stopCollection();
            
            if (success) {
              Alert.alert("Success", `Point collected and saved: ${selectedFeature.name}`);
            } else {
              Alert.alert("Warning", `Point collected but not saved: ${selectedFeature.name}`);
            }
          }).catch(error => {
            console.error('Error saving point:', error);
            stopCollection();
            Alert.alert("Error", "Failed to save point");
          });
        }
        break;
        
      case 'Line':
      case 'Polygon':
        if (!isCollecting && currentLocation) {
          const [longitude, latitude] = currentLocation;
          const positionObject: Position = { longitude, latitude };
          startCollection(positionObject, selectedFeature);
        }
        break;
        
      default:
        console.log("Unsupported feature type:", featureType);
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        <Button
          title="Collect"
          onPress={handleCollect}
          disabled={isCollecting && selectedFeature?.type === 'Point'}
        />
        
        {isCollecting && selectedFeature && 
         (selectedFeature.type === 'Line' || 
          selectedFeature.type === 'Polygon') && (
          <Button
            title="Stop Collection"
            onPress={stopCollection}
            color="#e74c3c"
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  }
});

export default CollectionButton;