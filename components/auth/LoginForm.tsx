import React, { useState } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmailInput } from './EmailInput';
import { PasswordInput } from './PasswordInput';
import { Colors } from '@/theme/colors';
import { LoginFormProps } from '@/types/auth.types';

export const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, isLoading }) => {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = () => {
    onSubmit(credentials.email, credentials.password);
  };

  return (
    <View style={styles.formContainer}>
      <EmailInput
        value={credentials.email}
        onChangeText={(text) => setCredentials(prev => ({ ...prev, email: text }))}
      />
      
      <PasswordInput
        value={credentials.password}
        onChangeText={(text) => setCredentials(prev => ({ ...prev, password: text }))}
        onSubmit={handleSubmit}
      />

      <Pressable
        style={({ pressed }) => [
          styles.loginButton,
          pressed && styles.loginButtonPressed,
          isLoading && styles.loginButtonDisabled
        ]}
        onPress={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <Text style={styles.loginButtonText}>Login</Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  formContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  loginButton: {
    width: '100%',
    height: 50,
    backgroundColor: Colors.DarkBlue,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  loginButtonPressed: {
    opacity: 0.8,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'RobotoSlab-Regular'
  },
});