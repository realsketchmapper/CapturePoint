import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocationContext } from '@/contexts/LocationContext';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { Colors } from '@/theme/colors';
import { usePointCollection } from '@/hooks/usePointCollection';
import { useLineCollection } from '@/hooks/useLineCollection';

const CollectionButton = () => {
  const { locationSource } = useLocationContext();
  const { selectedFeatureType } = useFeatureTypeContext();

  const { handlePointCollection } = usePointCollection();
  const { 
    handleLineCollection, 
    completeLine, 
    isCollecting, 
    currentPoints,
    removeLastPoint,
    cancelLine
  } = useLineCollection();

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
        handleLineCollection();
        break;
    }
  };

  return (
    <View style={styles.container}>
      {selectedFeatureType?.type === 'Line' && isCollecting ? (
        <>
          {/* Cancel button */}
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={cancelLine}
          >
            <MaterialIcons
              name="close"
              size={24}
              color={Colors.OffWhite}
            />
          </TouchableOpacity>

          {/* Back button (only show if we have points) */}
          {currentPoints.length > 0 && (
            <TouchableOpacity
              style={[styles.button, styles.backButton]}
              onPress={removeLastPoint}
            >
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={Colors.OffWhite}
              />
            </TouchableOpacity>
          )}

          {/* Collect button */}
          <TouchableOpacity
            style={[styles.button, styles.collectButton]}
            onPress={handleCollect}
          >
            <MaterialIcons
              name="add"
              size={24}
              color={Colors.OffWhite}
            />
          </TouchableOpacity>

          {/* Finish button (only show if we have at least 2 points) */}
          {currentPoints.length >= 2 && (
            <TouchableOpacity
              style={[styles.button, styles.finishButton]}
              onPress={completeLine}
            >
              <MaterialIcons
                name="check"
                size={24}
                color={Colors.OffWhite}
              />
            </TouchableOpacity>
          )}
        </>
      ) : (
        // Default collect button
        <TouchableOpacity
          style={[styles.button, styles.collectButton]}
          onPress={handleCollect}
        >
          <MaterialIcons
            name="play-arrow"
            size={24}
            color={Colors.OffWhite}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  collectButton: {
    backgroundColor: Colors.Aqua,
  },
  cancelButton: {
    backgroundColor: Colors.BrightRed,
  },
  backButton: {
    backgroundColor: Colors.DarkOrange,
  },
  finishButton: {
    backgroundColor: Colors.BrightGreen,
  },
});

export default CollectionButton;