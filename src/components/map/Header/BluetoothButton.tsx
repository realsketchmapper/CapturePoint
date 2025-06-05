import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BluetoothButtonProps } from '@/types/bluetooth.types';
import { useLocationContext } from '@/contexts/LocationContext';
import { useBluetooth } from '@/hooks/useBluetooth';
import { Colors } from '@/theme/colors';

export const BluetoothButton: React.FC<BluetoothButtonProps> = ({
  onPress,
  iconSize = 24,
  style,
}) => {
  const { locationSource } = useLocationContext();
  const { connectedDevice } = useBluetooth();
  
  // Show red if not using NMEA (device location) or if no device is connected
  // Show green if using NMEA and device is connected
  const iconColor = (locationSource === 'nmea' && connectedDevice) 
    ? Colors.Connected 
    : Colors.BrightRed;

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