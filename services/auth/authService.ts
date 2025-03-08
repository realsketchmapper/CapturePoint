import axios from 'axios';
import { API_ENDPOINTS } from '@/api/endpoints';
import { User, LoginResponse } from '@/types/auth.types';
import { tokenStorage } from './tokenStorage';
import NetInfo from '@react-native-community/netinfo';
import { api } from '@/api/clients'; // Import shared API client

export class AuthService {
  static async login(email: string, password: string): Promise<User> {
    try {
      // Check network connectivity
      const networkState = await NetInfo.fetch();
      const isConnected = !!networkState.isConnected;

      if (!isConnected) {
        console.log('Network unavailable, attempting offline login');
        return this.attemptOfflineLogin();
      }

      // Use the full URL for login since it might have a different base
      const response = await axios.post<LoginResponse>(
        API_ENDPOINTS.BASE_URL + API_ENDPOINTS.LOGIN,
        { email, password }
      );

      const { token, user_id } = response.data;
      
      if (!token || !user_id) {
        throw new Error('Invalid response from server');
      }

      await tokenStorage.storeCredentials(token, user_id.toString(), email);
      
      return {
        id: user_id,
        email,
        isOffline: false
      };
    } catch (error) {
      console.error('Login error:', error);
      
      if (axios.isAxiosError(error) && !error.response) {
        console.log('Server unreachable, attempting offline login');
        return this.attemptOfflineLogin();
      }
      throw error;
    }
  }

  private static async attemptOfflineLogin(): Promise<User> {
    const credentials = await tokenStorage.getStoredCredentials();
    
    if (!credentials) {
      throw new Error('No stored credentials found');
    }

    return {
      id: parseInt(credentials.userId),
      email: credentials.email,
      isOffline: true  // Mark as offline
    };
  }

  static async logout(): Promise<void> {
    await tokenStorage.clearCredentials();
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const credentials = await tokenStorage.getStoredCredentials();
      
      if (!credentials) {
        console.log('No stored credentials found');
        return null;
      }

      // Check network connectivity
      const networkState = await NetInfo.fetch();
      const isConnected = !!networkState.isConnected;

      // If we're offline, immediately return user with offline flag
      if (!isConnected) {
        console.log('Network unavailable, using stored credentials in offline mode');
        return {
          id: parseInt(credentials.userId),
          email: credentials.email,
          isOffline: true
        };
      }

      // If we're online, try to validate token with a server ping
      try {
        // Use the shared API client which already has token handling
        await api.get(API_ENDPOINTS.VALIDATE_TOKEN, {
          timeout: 5000 // Set a reasonable timeout
        });

        // If we get here, the token is valid
        console.log('Token validated successfully');
        return {
          id: parseInt(credentials.userId),
          email: credentials.email,
          isOffline: false
        };
      } catch (error) {
        console.log('Token validation failed, using offline mode', error);
        return {
          id: parseInt(credentials.userId),
          email: credentials.email,
          isOffline: true
        };
      }
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  static async validateToken(): Promise<boolean> {
    try {
      const credentials = await tokenStorage.getStoredCredentials();
      
      if (!credentials?.token) {
        return false;
      }

      // Check network connectivity
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected) {
        return false;
      }

      // Use the shared API client which already has token handling
      await api.get(API_ENDPOINTS.VALIDATE_TOKEN, {
        timeout: 5000
      });

      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }
}