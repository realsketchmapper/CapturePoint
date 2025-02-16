import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface SettingsButtonProps {
  onPress: () => void;
  iconSize?: number;
  iconColor?: string;
  style?: object;
}

export const SettingsButton: React.FC<SettingsButtonProps> = ({
  onPress,
  iconSize = 24,
  iconColor = 'white',
  style,
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <MaterialIcons
        name="settings"
        size={iconSize}
        color={iconColor}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
});