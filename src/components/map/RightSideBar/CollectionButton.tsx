import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocationContext } from '@/contexts/LocationContext';
import { useFeatureTypeContext } from '@/contexts/FeatureTypeContext';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { Colors } from '@/theme/colors';
import { usePointCollection } from '@/hooks/usePointCollection';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { useBluetooth } from '@/hooks/useBluetooth';
import { FeatureFormModal } from '@/components/modals/PointModals/FeatureFormModal';

const CollectionButton = () => {
  const { locationSource, currentLocation } = useLocationContext();
  const { selectedFeatureType } = useFeatureTypeContext();
  const { settings } = useSettingsContext();
  const { isConnectedToRTKPro, connectedDevice } = useBluetooth();
  const { 
    handlePointCollection, 
    isFormModalVisible, 
    handleFormSubmit, 
    handleFormCancel 
  } = usePointCollection();
  const { isCollecting, startCollection, recordPoint } = useCollectionContext();

  // Add debug log for modal visibility
  useEffect(() => {
    console.log('Form modal visibility changed:', isFormModalVisible);
  }, [isFormModalVisible]);

  // Don't render if not using NMEA
  if (locationSource !== 'nmea') {
    return null;
  }

  // Hide the collection button if connected to RTK-Pro and the setting is enabled
  if (settings.hideCollectionButtonForRTKPro && isConnectedToRTKPro()) {
    return null;
  }

  const handleCollect = () => {
    if (!selectedFeatureType || !currentLocation) return;

    switch (selectedFeatureType.type) {
      case 'Point':
        handlePointCollection();
        break;
      case 'Line':
        // If already collecting, add a new point to the line
        if (isCollecting) {
          recordPoint(currentLocation);
        } else {
          // Start a new line collection with the current location
          try {
            startCollection(currentLocation, selectedFeatureType);
          } catch (error) {
            console.error('Error starting line collection:', error);
          }
        }
        break;
    }
  };

  // Determine the button appearance based on the selected feature type
  const getButtonAppearance = () => {
    if (!selectedFeatureType) {
      return {
        color: Colors.Grey,
        icon: 'add-location' as const
      };
    }

    // Show different icon based on feature type and collection state
    if (selectedFeatureType.type === 'Line') {
      return {
        color: isCollecting ? Colors.Yellow : Colors.BrightGreen,
        icon: isCollecting ? 'adjust' as const : 'linear-scale' as const
      };
    } else {
      return {
        color: Colors.BrightGreen,
        icon: 'add-location' as const
      };
    }
  };

  const { color, icon } = getButtonAppearance();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, selectedFeatureType && styles.activeButton]}
        onPress={handleCollect}
        disabled={!selectedFeatureType}
      >
        <MaterialIcons 
          name={icon} 
          size={24} 
          color={color} 
        />
      </TouchableOpacity>

      {/* Feature Form Modal */}
      {selectedFeatureType && (
        <FeatureFormModal
          isVisible={isFormModalVisible}
          onClose={handleFormCancel}
          onSubmit={handleFormSubmit}
          featureType={selectedFeatureType}
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