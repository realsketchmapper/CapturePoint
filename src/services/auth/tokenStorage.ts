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
      console.log(`Storing credentials for user: ${email}`);
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_CREDENTIALS,
        JSON.stringify(credentials)
      );
      console.log('Credentials stored successfully');
    } catch (error) {
      console.error('Error storing credentials:', error);
      throw error;
    }
  },

  async getStoredCredentials(): Promise<StoredCredentials | null> {
    try {
      const credentialsJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_CREDENTIALS);
      if (!credentialsJson) {
        console.log('No stored credentials found');
        return null;
      }
      
      try {
        const credentials = JSON.parse(credentialsJson) as StoredCredentials;
        console.log(`Retrieved credentials for user: ${credentials.email}`);
        return credentials;
      } catch (parseError) {
        console.error('Error parsing stored credentials:', parseError);
        // If JSON is invalid, remove the corrupted data
        await this.clearCredentials();
        return null;
      }
    } catch (error) {
      console.error('Error getting stored credentials:', error);
      return null;
    }
  },

  async clearCredentials(): Promise<void> {
    try {
      console.log('Clearing stored credentials');
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_CREDENTIALS);
      console.log('Credentials cleared successfully');
    } catch (error) {
      console.error('Error clearing credentials:', error);
      throw error;
    }
  }
};