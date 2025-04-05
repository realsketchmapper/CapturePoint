import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../constants/storage';

interface StoredCredentials {
  token: string;
  userId: string;
  email: string;
  name: string;
}

export const tokenStorage = {
  async storeCredentials(
    token: string,
    userId: string,
    email: string,
    name: string
  ): Promise<void> {
    try {
      const credentials: StoredCredentials = {
        token,
        userId,
        email,
        name
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_CREDENTIALS,
        JSON.stringify(credentials)
      );
    } catch (error) {
      console.error('Error storing credentials:', error);
      throw error;
    }
  },

  async getStoredCredentials(): Promise<StoredCredentials | null> {
    try {
      const credentialsJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_CREDENTIALS);
      if (!credentialsJson) {
        return null;
      }
      return JSON.parse(credentialsJson) as StoredCredentials;
    } catch (error) {
      console.error('Error getting stored credentials:', error);
      return null;
    }
  },

  async clearCredentials(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_CREDENTIALS);
  }
};