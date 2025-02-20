// src/containers/RightSidebarContainer.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CollectionButton } from '../CollectionButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const RightSidebarContainer: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <View 
      style={[
        styles.container,
        {
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 10,
          right: insets.right + 10
        }
      ]}
    >
      <CollectionButton />
      {/* Add more buttons here as needed */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    width: 60,  // Adjust based on your button sizes
    justifyContent: 'flex-start',
    alignItems: 'center',
    zIndex: 1,  // Ensure it stays above the map
  }
});