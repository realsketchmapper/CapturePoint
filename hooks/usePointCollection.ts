import { Alert } from 'react-native';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { useFeatureContext } from '@/FeatureContext';
import { useLocationContext } from '@/contexts/LocationContext';
import { useMapContext } from '@/contexts/MapDisplayContext';

export const usePointCollection = () => {
  const { startCollection, stopCollection, saveCurrentPoint } = useCollectionContext();
  const { selectedFeatureType } = useFeatureContext();
  const { currentLocation } = useLocationContext();
  const { addPoint, removeFeature } = useMapContext();

  const handlePointCollection = async () => {
    if (!selectedFeatureType) {
      Alert.alert("No Feature Type Selected", "Please select a feature type first.");
      return;
    }
    
    if (!currentLocation) {
      Alert.alert("No Position", "GNSS position not available.");
      return;
    }

    if (selectedFeatureType.geometryType !== 'Point') {
      return; // Only handle point collection
    }
    
    // Start collection and wait for it to complete
    const newState = startCollection(currentLocation, selectedFeatureType);
    if (!newState.isActive) {
      console.error('Failed to start collection');
      return;
    }
    
    // Add point to map
    const pointId = addPoint(currentLocation, {
      name: selectedFeatureType.name,
      category: selectedFeatureType.category
    });
    
    if (!pointId) {
      console.error('Failed to add point to map');
      Alert.alert("Error", "Failed to create point. Please try again.");
      return;
    }
    
    // Stop collection since point is already saved in startCollection
    stopCollection();
  };

  return { handlePointCollection };
}; 