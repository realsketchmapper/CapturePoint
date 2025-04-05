import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocationContext } from '@/contexts/LocationContext';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { Colors } from '@/theme/colors';
import { useLineCollection } from '@/hooks/useLineCollection';
import { usePointCollection } from '@/hooks/usePointCollection';
import { LineCollectionControls } from './LineCollectionControls';

const CollectionButton = () => {
  const { locationSource } = useLocationContext();
  const { selectedFeatureType } = useFeatureTypeContext();
  const { 
    isCollectingLine,
    linePoints,
    handleLinePointCollection,
    handleCompleteLine,
    handleUndoPoint,
    handleCancelLine
  } = useLineCollection();
  const { handlePointCollection } = usePointCollection();

  // Don't render if not using NMEA
  if (locationSource !== 'nmea') {
    return null;
  }

  const handleCollect = () => {
    if (!selectedFeatureType) return;

    switch (selectedFeatureType.geometryType) {
      case 'Point':
        handlePointCollection();
        break;
      case 'Line':
        if (!isCollectingLine) {
          handleLinePointCollection();
        }
        break;
    }
  };

  return (
    <View style={styles.container}>
      {!isCollectingLine ? (
        <TouchableOpacity 
          style={styles.button}
          onPress={handleCollect}
          disabled={!selectedFeatureType}
        >
          <MaterialIcons
            name={selectedFeatureType?.geometryType === 'Line' ? 'timeline' : 'add-location'}
            size={24}
            color={Colors.DarkBlue}
          />
        </TouchableOpacity>
      ) : (
        <LineCollectionControls
          onComplete={handleCompleteLine}
          onUndo={handleUndoPoint}
          onCancel={handleCancelLine}
          canUndo={linePoints.length > 0}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center'
  },
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