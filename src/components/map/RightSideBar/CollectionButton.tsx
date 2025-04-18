import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocationContext } from '@/contexts/LocationContext';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { Colors } from '@/theme/colors';
import { usePointCollection } from '@/hooks/usePointCollection';
import { LineCollectionControls } from './LineCollectionControls';
import { useLineCollection } from '@/hooks/useLineCollection';

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

    switch (selectedFeatureType.type) {
      case 'Point':
        handlePointCollection();
        break;
      case 'Line':
        handleLinePointCollection();
        break;
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isCollectingLine && styles.activeButton]}
        onPress={handleCollect}
      >
        <MaterialIcons 
          name="add-location" 
          size={24} 
          color={isCollectingLine ? Colors.BrightGreen : Colors.DarkBlue} 
        />
      </TouchableOpacity>

      {isCollectingLine && (
        <LineCollectionControls
          onComplete={handleCompleteLine}
          onUndo={handleUndoPoint}
          onCancel={handleCancelLine}
          canUndo={linePoints.length > 0}
          canComplete={linePoints.length >= 2}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
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
  },
  activeButton: {
    backgroundColor: Colors.OffWhite,
  }
});

export default CollectionButton;