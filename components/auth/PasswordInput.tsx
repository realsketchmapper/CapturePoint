import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { } from 'react-native/Libraries/NewAppScreen';
import { Colors } from '@/theme/colors';

interface PasswordInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChangeText,
  onSubmit
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={{ width: '100%', position: 'relative' }}>
      <TextInput
        style={[styles.input, styles.passwordInput]}
        placeholder="Password"
        secureTextEntry={!showPassword}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="done"
        textContentType="password"
      />
      <TouchableOpacity
        style={styles.eyeIcon}
        onPress={() => setShowPassword(!showPassword)}
      >
        <Ionicons
          name={showPassword ? 'eye-off' : 'eye'}
          size={24}
          color="#888"
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    fontFamily: 'RobotoSlab-Regular'
  },
  passwordInput: {
    paddingRight: 50, // Make room for the eye icon
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 13,
  },
});
