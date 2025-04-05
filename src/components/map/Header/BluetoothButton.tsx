import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BluetoothButtonProps } from '@/types/bluetooth.types';
import { useLocationContext } from '@/contexts/LocationContext';

import { Colors } from '@/theme/colors';

export const BluetoothButton: React.FC<BluetoothButtonProps> = ({
  onPress,
  iconSize = 24,
  style,
}) => {
  const { locationSource } = useLocationContext();
  
  const iconColor = locationSource === 'device' ? Colors.BrightRed : Colors.Connected;

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <MaterialIcons
        name="bluetooth"
        size={iconSize}
        color={iconColor}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 0,
  },
});