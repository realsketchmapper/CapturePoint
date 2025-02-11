import AsyncStorage from '@react-native-async-storage/async-storage';

interface StoredCredentials {
  token: string;
  userId: string;
  email: string;
}

export const tokenStorage = {
  async storeCredentials(
    token: string,
    userId: string,
    email: string
  ): Promise<void> {
    await AsyncStorage.multiSet([
      ['userToken', token],
      ['userId', userId],
      ['userEmail', email]
    ]);
  },

  async getStoredCredentials(): Promise<StoredCredentials | null> {
    const credentials = await AsyncStorage.multiGet([
      'userToken',
      'userId',
      'userEmail'
    ]);
    
    const [token, userId, email] = credentials.map(([_, value]) => value);

    if (!token || !userId || !email) {
      return null;
    }

    return { token, userId, email };
  },

  async clearCredentials(): Promise<void> {
    await AsyncStorage.multiRemove(['userToken', 'userId', 'userEmail']);
  }
};