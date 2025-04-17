import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayerControl } from './LayerControl';

export const LeftSidebarContainer: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <View 
      style={[
        styles.container,
        {
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 10,
          left: insets.left + 1
        }
      ]}
    >
      <LayerControl />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 10,
    top: 0,
    bottom: 0,
    width: 60, 
    justifyContent: 'flex-start',
    alignItems: 'center',
    zIndex: 1, 
  }
});
