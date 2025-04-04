import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SettingsButtonProps } from '@/types/settings.types';
import { Colors } from '@/src/theme/colors';

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