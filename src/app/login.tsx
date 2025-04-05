import React from 'react';
import {
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  StyleSheet
} from 'react-native';
import { router } from 'expo-router';
import { useAuthContext } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { Colors } from '@/theme/colors';

export default function Login() {
  const { login, isLoading, error } = useAuthContext();

  const handleLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
      router.replace('../projectview');
    } catch (err) {
      Alert.alert('Login Failed', error || 'An unexpected error occurred');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.innerContainer}>
          <Image
            source={require('@/assets/images/bhug_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          
          <LoginForm 
            onSubmit={handleLogin}
            isLoading={isLoading}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.VeryLightGrey,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    padding: 20,
  },
  innerContainer: {
    alignItems: 'center',
    width: '100%',
  },
  logo: {
    width: 200,
    height: 100,
    marginBottom: 40,
  },
}); 