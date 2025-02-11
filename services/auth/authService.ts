import axios from 'axios';
import { API_ENDPOINTS } from '@/api/endpoints';
import { User, LoginResponse } from '@/types/auth.types';
import { tokenStorage } from './tokenStorage';

export class AuthService {
  static async login(email: string, password: string): Promise<User> {
    try {
      const response = await axios.post<LoginResponse>(
        API_ENDPOINTS.LOGIN,
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
      if (axios.isAxiosError(error) && !error.response) {
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
      isOffline: true
    };
  }

  static async logout(): Promise<void> {
    await tokenStorage.clearCredentials();
  }

  static async getCurrentUser(): Promise<User | null> {
    const credentials = await tokenStorage.getStoredCredentials();
    
    if (!credentials) {
      return null;
    }

    return {
      id: parseInt(credentials.userId),
      email: credentials.email,
      isOffline: false
    };
  }
}