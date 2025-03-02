import React from 'react';
import { Button, View, StyleSheet } from 'react-native';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { useFeatureContext } from '@/contexts/FeatureContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { Position } from '@/types/collection.types';

const CollectionButton = () => {
  const { isCollecting, startCollection, stopCollection, recordPoint } = 
  useCollectionContext();
  const { selectedFeature } = useFeatureContext();
  const { currentLocation } = useLocationContext(); 
  
  const handleCollect = () => {
    if (!selectedFeature) {
        console.log("no feature selected");
        return
    }
    
    const featureType = selectedFeature.type.toLowerCase();
    switch (featureType) {
      case 'point':
        if (currentLocation) {
          const [longitude, latitude] = currentLocation;
          const positionObject: Position = { longitude, latitude };
          startCollection(positionObject, selectedFeature);
          stopCollection();
        }
        break;
      case 'line':
      case 'polygon':
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
      {/* Primary collection button */}
      <Button
        title="Collect"
        onPress={handleCollect}
        disabled={isCollecting && selectedFeature?.type.toLowerCase() === 'point'}
      />
      
      {/* Stop collection button - only shown when collecting a line/polygon */}
      {isCollecting && selectedFeature && 
       (selectedFeature.type.toLowerCase() === 'line' || 
        selectedFeature.type.toLowerCase() === 'polygon') && (
        <Button
          title="Stop Collection"
          onPress={stopCollection}
          color="#e74c3c"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    gap: 10,
  }
});

export default CollectionButton;