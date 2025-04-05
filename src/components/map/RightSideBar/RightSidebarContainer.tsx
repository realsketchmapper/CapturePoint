// src/containers/RightSidebarContainer.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CollectionButton from './CollectionButton';

export const RightSidebarContainer: React.FC = () => {
  const insets = useSafeAreaInsets();

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
    >
      <CollectionButton />
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