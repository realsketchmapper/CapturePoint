import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FeatureButtonProps } from '@/types/features.types';
import { Colors } from '@/theme/colors';

export const FeatureButton: React.FC<FeatureButtonProps> = ({ onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.button} 
      onPress={onPress}
    >
      <MaterialCommunityIcons 
        name="map-marker-plus" 
        size={24} 
        color={Colors.DarkBlue}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 0,
  },
});