import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeatureType } from '@/types/featureType.types';
import { STORAGE_KEYS } from '@/constants/storage';

/**
 * Service for managing feature types in local storage
 * Provides methods for storing and retrieving feature types for offline use
 */
class FeatureTypeStorageService {
  // In-memory cache to reduce AsyncStorage operations
  private featureTypesCache: Map<number, FeatureType[]> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache TTL

  /**
   * Gets the storage key for a specific project's feature types
   * @param projectId - The project ID
   * @returns The storage key
   */
  private getFeatureTypesKey(projectId: number): string {
    return `${STORAGE_KEYS.FEATURE_TYPES_PREFIX}_${projectId}`;
  }

  /**
   * Stores feature types for a project in local storage
   * @param projectId - The project ID
   * @param featureTypes - The feature types to store
   * @returns Promise that resolves when the feature types are stored
   */
  async storeFeatureTypes(projectId: number, featureTypes: FeatureType[]): Promise<void> {
    try {
      console.log(`Storing ${featureTypes.length} feature types for project ${projectId}`);
      const storageKey = this.getFeatureTypesKey(projectId);
      
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify(featureTypes)
      );
      
      // Update cache
      this.featureTypesCache.set(projectId, featureTypes);
      this.cacheTimestamp = Date.now();
      
      console.log('Feature types stored successfully');
    } catch (error) {
      console.error('Error storing feature types:', error);
      throw error;
    }
  }

  /**
   * Retrieves feature types for a project from local storage
   * @param projectId - The project ID
   * @returns Promise that resolves with the stored feature types or empty array if none found
   */
  async getStoredFeatureTypes(projectId: number): Promise<FeatureType[]> {
    try {
      // Check if cache is valid
      if (this.featureTypesCache.has(projectId) && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
        const cachedTypes = this.featureTypesCache.get(projectId);
        console.log(`Returning ${cachedTypes?.length || 0} cached feature types for project ${projectId}`);
        return cachedTypes || [];
      }

      const storageKey = this.getFeatureTypesKey(projectId);
      console.log(`Fetching feature types from storage for project ${projectId}`);
      const typesJson = await AsyncStorage.getItem(storageKey);
      
      if (!typesJson) {
        console.log(`No stored feature types found for project ${projectId}`);
        return [];
      }
      
      try {
        const featureTypes = JSON.parse(typesJson) as FeatureType[];
        console.log(`Retrieved ${featureTypes.length} feature types from storage for project ${projectId}`);
        
        // Update cache
        this.featureTypesCache.set(projectId, featureTypes);
        this.cacheTimestamp = Date.now();
        
        return featureTypes;
      } catch (parseError) {
        console.error('Error parsing stored feature types:', parseError);
        // If JSON is invalid, clear it
        await AsyncStorage.removeItem(storageKey);
        return [];
      }
    } catch (error) {
      console.error('Error getting stored feature types:', error);
      return [];
    }
  }

  /**
   * Clears stored feature types for a project
   * @param projectId - The project ID
   * @returns Promise that resolves when the feature types are cleared
   */
  async clearFeatureTypes(projectId: number): Promise<void> {
    try {
      const storageKey = this.getFeatureTypesKey(projectId);
      console.log(`Clearing feature types for project ${projectId}`);
      await AsyncStorage.removeItem(storageKey);
      this.featureTypesCache.delete(projectId);
      console.log('Feature types cleared successfully');
    } catch (error) {
      console.error('Error clearing feature types:', error);
      throw error;
    }
  }

  /**
   * Clears all stored feature types for all projects
   * @returns Promise that resolves when all feature types are cleared
   */
  async clearAllFeatureTypes(): Promise<void> {
    try {
      console.log('Clearing all stored feature types');
      
      // Get all keys in AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Filter keys related to feature types
      const featureTypeKeys = allKeys.filter(key => 
        key.startsWith(`${STORAGE_KEYS.FEATURE_TYPES_PREFIX}_`)
      );
      
      if (featureTypeKeys.length > 0) {
        // Remove all feature type keys
        await AsyncStorage.multiRemove(featureTypeKeys);
        console.log(`Cleared ${featureTypeKeys.length} feature type storage keys`);
      } else {
        console.log('No feature type storage keys found');
      }
      
      // Clear cache
      this.featureTypesCache.clear();
      console.log('All feature types cleared successfully');
    } catch (error) {
      console.error('Error clearing all feature types:', error);
      throw error;
    }
  }
}

export const featureTypeStorageService = new FeatureTypeStorageService(); 