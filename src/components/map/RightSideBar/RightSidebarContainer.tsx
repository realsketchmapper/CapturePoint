// src/containers/RightSidebarContainer.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CollectionButton from './CollectionButton';
import { useCollectionContext } from '@/contexts/CollectionContext';
import { LineCollectionControls } from './LineCollectionControls';

export const RightSidebarContainer: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { 
    isCollecting,
    activeFeatureType,
    currentPoints,
    stopCollection,
    clearCollection,
    undoLastPoint
  } = useCollectionContext();

  // Check if we're collecting a line
  const isLineFeature = activeFeatureType?.type === 'Line';
  
  // Check if we can undo (remove the last point)
  const canUndo = isCollecting && currentPoints.length > 1;
  
  // Check if we can complete the line
  const canComplete = isCollecting && currentPoints.length >= 2;
  
  // Handlers for line collection actions
  const handleComplete = () => {
    if (!isCollecting || !canComplete) return;
    stopCollection();
  };
  
  const handleUndo = () => {
    if (!isCollecting || !canUndo) return;
    undoLastPoint();
  };
  
  const handleCancel = () => {
    if (!isCollecting) return;
    clearCollection();
  };

  return (
    <View 
      style={[
        styles.container,
        {
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 10,
          right: insets.right + 1
        }
      ]}
      pointerEvents="box-none"
    >
      <CollectionButton />
      
      {/* Show line collection controls when collecting a line */}
      {isCollecting && isLineFeature && (
        <LineCollectionControls
          onComplete={handleComplete}
          onUndo={handleUndo}
          onCancel={handleCancel}
          canUndo={canUndo}
          canComplete={canComplete}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    width: 60, 
    justifyContent: 'flex-start',
    alignItems: 'center',
    zIndex: 1, 
  }
});