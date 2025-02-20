import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useCollection } from '@/contexts/CollectionContext';
import { useNMEAContext } from '@/contexts/NMEAContext';
import { useFeature } from '@/hooks/useFeature';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { useLinePreview } from './LinePreview';
import { useCollectionValidation } from '@/hooks/useCollectionValidation';
import { renderFeatureService } from '@/services/render_features/renderFeatureService';
import { Position } from '@/types/collection.types';

export const CollectionButton: React.FC = () => {
  const { isCollecting, startCollection, recordPoint } = useCollection();
  const { ggaData } = useNMEAContext();
  const { selectedFeature } = useFeature();
  const { renderFeature } = useMapContext();
  const { validateCollection } = useCollectionValidation();
  const { 
    startCollection: startLinePreview, 
    updatePreview, 
    collectPoint,
    finishCollection: finishLinePreview,
    isCollecting: isCollectingLine 
  } = useLinePreview();

  const getCurrentPosition = () => ({
    longitude: ggaData!.longitude,
    latitude: ggaData!.latitude
  });

  // Update preview line when GPS position changes
  useEffect(() => {
    if (isCollectingLine && selectedFeature?.type.toLowerCase() === 'line') {
      const position = getCurrentPosition();
      updatePreview([position.longitude, position.latitude] as [number, number]);
    }
  }, [ggaData?.longitude, ggaData?.latitude, isCollectingLine]);

  const handleStartCollection = (position: Position) => {
    const success = startCollection(position, selectedFeature!);
    if (success && selectedFeature?.type.toLowerCase() === 'line') {
      // Start line preview instead of rendering immediately
      startLinePreview();
      const pointId = collectPoint([position.longitude, position.latitude] as [number, number]);
      console.log("Started line collection with point:", pointId);
    } else if (!success) {
      renderFeatureService.handleCollectionError('Failed to start collection');
    }
  };

  const handleRecordPoint = (position: Position) => {
    const success = recordPoint(position);
    if (success && selectedFeature?.type.toLowerCase() === 'line') {
      // Add point to preview line
      const pointId = collectPoint([position.longitude, position.latitude] as [number, number]);
      console.log("Added point to line:", pointId);
    } else if (!success) {
      renderFeatureService.handleCollectionError('Failed to add point');
    }
  };

  const handleFinishCollection = () => {
    // If we're collecting a line, finish the preview and create final feature
    if (isCollectingLine && selectedFeature?.type.toLowerCase() === 'line') {
      const lineId = finishLinePreview();
      if (lineId) {
        console.log("Finished line collection:", lineId);
      }
    }
    // Add any additional cleanup or finish logic here
  };

  const handlePress = () => {
    if (!validateCollection(selectedFeature, ggaData)) return;
    
    const position = getCurrentPosition();
    if (!isCollecting) {
      handleStartCollection(position);
    } else {
      handleRecordPoint(position);
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.button, isCollecting ? styles.collecting : null]} 
      onPress={handlePress}
    >
      <Text style={styles.text}>
        {isCollecting ? 'Add Point' : 'Start Collection'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 15,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    margin: 10,
  },
  collecting: {
    backgroundColor: '#FF3B30',
  },
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});