import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/theme/colors';

interface FeatureButtonProps {
  onPress: () => void;
}

export const FeatureButton: React.FC<FeatureButtonProps> = ({ onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.button} 
      onPress={onPress}
    >
      <MaterialCommunityIcons 
        name="map-marker-plus" 
        size={24} 
        color='white'
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 8,
    borderRadius: 4,
  },
});