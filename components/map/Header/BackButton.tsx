import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/src/theme/colors';

export const BackButton: React.FC = () => {
  const handleBack = () => {
    router.replace('/projectview');
  };

  return (
    <TouchableOpacity 
      style={styles.button}
      onPress={handleBack}
    >
      <MaterialIcons 
        name="arrow-back" 
        size={24} 
        color={Colors.DarkBlue}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingLeft: 8,
  },
}); 