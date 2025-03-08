import React from 'react';
import { TextInput, StyleSheet} from 'react-native';
import { EmailInputProps } from '@/types/auth.types';

export const EmailInput: React.FC<EmailInputProps> = ({
  value,
  onChangeText,
  onSubmit
}) => {
  return (
    <TextInput
      style={styles.input}
      placeholder="Email"
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      autoCapitalize="none"
      keyboardType="email-address"
      returnKeyType="next"
      autoComplete="email"
      textContentType="emailAddress"
    />
  );
};

export const styles = StyleSheet.create({
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
});