import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserFootageSummary } from '@/types/project.types';
import { STORAGE_KEYS } from '@/constants/storage';

/**
 * Service for managing user footage data in local storage
 * Stores footage calculations for each project and user
 */
class FootageStorageService {
  // In-memory cache to reduce AsyncStorage operations
  private footageCache: Map<string, UserFootageSummary> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache TTL

  /**
   * Gets the storage key for a specific project and user's footage data
   * @param projectId - The project ID
   * @param userId - The user ID
   * @returns The storage key
   */
  private getFootageKey(projectId: number, userId: number): string {
    return `@user_footage_${projectId}_${userId}`;
  }

  /**
   * Saves footage data for a user on a project
   * @param projectId - The project ID
   * @param userId - The user ID
   * @param footageData - The footage data to save
   */
  async saveUserFootage(projectId: number, userId: number, footageData: UserFootageSummary): Promise<void> {
    try {
      const storageKey = this.getFootageKey(projectId, userId);
      console.log(`💾 Saving footage data for user ${userId} on project ${projectId}`);
      
      await AsyncStorage.setItem(storageKey, JSON.stringify(footageData));
      
      // Update cache
      this.footageCache.set(storageKey, footageData);
      this.cacheTimestamp = Date.now();
      
      console.log('✅ Footage data saved to local storage');
    } catch (error) {
      console.error('❌ Error saving footage data:', error);
      throw error;
    }
  }

  /**
   * Gets footage data for a specific user on a project
   * @param projectId - The project ID
   * @param userId - The user ID
   * @returns The footage data or null if not found
   */
  async getUserFootage(projectId: number, userId: number): Promise<UserFootageSummary | null> {
    try {
      const storageKey = this.getFootageKey(projectId, userId);
      
      // Check cache first
      const cachedData = this.footageCache.get(storageKey);
      if (cachedData && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
        return cachedData;
      }

      const footageJson = await AsyncStorage.getItem(storageKey);
      
      if (!footageJson) {
        return null;
      }

      const footageData = JSON.parse(footageJson) as UserFootageSummary;
      
      // Update cache
      this.footageCache.set(storageKey, footageData);
      this.cacheTimestamp = Date.now();
      
      return footageData;
    } catch (error) {
      console.error('❌ Error getting footage data:', error);
      return null;
    }
  }

  /**
   * Gets all footage data for a project (all users)
   * @param projectId - The project ID
   * @returns Object with user IDs as keys and footage data as values
   */
  async getAllProjectFootage(projectId: number): Promise<{ [userId: string]: UserFootageSummary }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const projectFootageKeys = allKeys.filter(key => 
        key.startsWith(`@user_footage_${projectId}_`)
      );
      
      const footageData: { [userId: string]: UserFootageSummary } = {};
      
      for (const key of projectFootageKeys) {
        const userId = key.split('_').pop(); // Extract user ID from key
        if (userId) {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            footageData[userId] = JSON.parse(data);
          }
        }
      }
      
      return footageData;
    } catch (error) {
      console.error('❌ Error getting all project footage:', error);
      return {};
    }
  }

  /**
   * Clears footage data for a specific project (all users)
   * @param projectId - The project ID
   */
  async clearProjectFootage(projectId: number): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const projectFootageKeys = allKeys.filter(key => 
        key.startsWith(`@user_footage_${projectId}_`)
      );
      
      await AsyncStorage.multiRemove(projectFootageKeys);
      
      // Clear from cache
      projectFootageKeys.forEach(key => {
        this.footageCache.delete(key);
      });
      
      console.log(`🗑️ Cleared footage data for project ${projectId}`);
    } catch (error) {
      console.error('❌ Error clearing project footage:', error);
      throw error;
    }
  }

  /**
   * Invalidates the cache
   */
  invalidateCache(): void {
    this.footageCache.clear();
    this.cacheTimestamp = 0;
  }
}

export const footageStorageService = new FootageStorageService(); 