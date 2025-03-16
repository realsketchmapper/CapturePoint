import axios from 'axios';
import { API_ENDPOINTS } from '@/api/endpoints';
import { User, LoginResponse } from '@/types/auth.types';
import { tokenStorage } from './tokenStorage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { api } from '@/api/clients'; // Import shared API client
import { ExtendedAxiosRequestConfig } from '@/types/api.types';

const NETWORK_TIMEOUT = 10000; // Increase timeout to 10 seconds
const INITIAL_VALIDATION_TIMEOUT = 10000; // Increased from 5000ms to 10000ms

export class AuthService {
  static async login(email: string, password: string): Promise<User> {
    try {
      console.log('Login attempt started for email:', email);
      
      // Clear any existing credentials first
      console.log('Clearing any existing credentials...');
      await tokenStorage.clearCredentials();
      
      // Check network connectivity
      const networkState = await NetInfo.fetch();
      const isConnected = !!networkState.isConnected;

      console.log('Network state:', { isConnected, details: networkState });

      if (!isConnected) {
        console.log('Network unavailable, attempting offline login');
        return this.attemptOfflineLogin();
      }

      const loginUrl = API_ENDPOINTS.BASE_URL + API_ENDPOINTS.LOGIN;
      console.log('Attempting login to:', loginUrl);
      console.log('Request payload:', { email, password: '[REDACTED]' });
      
      // Use the full URL for login since it might have a different base
      const response = await axios.post<LoginResponse>(
        loginUrl,
        { email, password },
        { 
          timeout: NETWORK_TIMEOUT,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      console.log('Raw response:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: JSON.stringify(response.data, null, 2)
      });

      if (!response.data) {
        console.error('No response data received');
        throw new Error('No response data received from server');
      }

      // Parse the stringified response data
      const parsedData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

      console.log('Response data structure:', {
        keys: Object.keys(parsedData),
        dataType: typeof parsedData,
        isObject: parsedData instanceof Object
      });

      const { token, user_id, user_name: name } = parsedData;
      
      console.log('Storing credentials...');
      await tokenStorage.storeCredentials(token, user_id.toString(), email, name);
      console.log('Credentials stored successfully');
      
      return {
        id: user_id,
        email,
        name,
        isOffline: false
      };
    } catch (error) {
      console.error('Login error details:', {
        isAxiosError: axios.isAxiosError(error),
        errorType: typeof error,
        errorInstance: error instanceof Error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        fullError: error
      });

      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          code: error.code,
          message: error.message,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers
          }
        });
      }
      
      if (axios.isAxiosError(error) && (!error.response || error.code === 'ECONNABORTED')) {
        console.log('Server unreachable or timeout, attempting offline login');
        return this.attemptOfflineLogin();
      }
      throw error;
    }
  }

  private static async attemptOfflineLogin(): Promise<User> {
    console.log('Attempting offline login...');
    const credentials = await tokenStorage.getStoredCredentials();
    
    if (!credentials) {
      console.error('No stored credentials found for offline login');
      throw new Error('No stored credentials found');
    }

    console.log('Found stored credentials, creating offline user');
    return {
      id: parseInt(credentials.userId),
      email: credentials.email,
      name: credentials.name,
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

      // Check network connectivity first to avoid unnecessary timeouts
      const networkState = await Promise.race([
        NetInfo.fetch(),
        new Promise<NetInfoState>(resolve => setTimeout(() => resolve({ isConnected: false } as NetInfoState), 2000))
      ]);

      // If we're offline, immediately return user with offline flag
      if (!networkState.isConnected) {
        console.log('Network unavailable, using stored credentials in offline mode');
        return {
          id: parseInt(credentials.userId),
          email: credentials.email,
          name: credentials.name,
          isOffline: true
        };
      }

      // If we're online, try to validate token with a server ping
      try {
        const isValid = await this.validateToken(true);

        if (!isValid) {
          console.log('Token validation failed, using offline mode');
          return {
            id: parseInt(credentials.userId),
            email: credentials.email,
            name: credentials.name,
            isOffline: true
          };
        }

        // If we get here, the token is valid
        console.log('Token validated successfully');
        return {
          id: parseInt(credentials.userId),
          email: credentials.email,
          name: credentials.name,
          isOffline: false
        };
      } catch (error) {
        console.log('Token validation error, using offline mode:', error);
        return {
          id: parseInt(credentials.userId),
          email: credentials.email,
          name: credentials.name,
          isOffline: true
        };
      }
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  static async validateToken(isInitialValidation = false): Promise<boolean> {
    try {
      const credentials = await tokenStorage.getStoredCredentials();
      
      if (!credentials?.token) {
        return false;
      }

      // Check network connectivity first with a reasonable timeout
      const networkState = await Promise.race([
        NetInfo.fetch(),
        new Promise<NetInfoState>(resolve => setTimeout(() => resolve({ isConnected: false } as NetInfoState), 3000))
      ]);

      if (!networkState.isConnected) {
        console.log('Network unavailable for token validation');
        return false;
      }

      try {
        await api.get(API_ENDPOINTS.VALIDATE_TOKEN, {
          timeout: INITIAL_VALIDATION_TIMEOUT,
          retry: 1, // Always allow 1 retry, even for initial validation
          retryDelay: 2000
        } as ExtendedAxiosRequestConfig);

        return true;
      } catch (error) {
        if (isInitialValidation && axios.isAxiosError(error) && (!error.response || error.code === 'ECONNABORTED')) {
          console.log('Token validation timeout - retrying...');
          return false;
        }
        throw error;
      }
    } catch (error) {
      if (axios.isAxiosError(error) && (!error.response || error.code === 'ECONNABORTED')) {
        console.log('Token validation timeout/network error');
      } else {
        console.error('Token validation error:', error);
      }
      return false;
    }
  }
}