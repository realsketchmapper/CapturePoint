import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeatureType } from '@/types/featureType.types';
import { STORAGE_KEYS } from '@/constants/storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

/**
 * Service for managing feature types in local storage
 * Provides methods for storing and retrieving feature types for offline use
 */
class FeatureTypeStorageService {
  // In-memory cache to reduce AsyncStorage operations
  private featureTypesCache: Map<number, FeatureType[]> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache TTL
  private imagesCache: Map<string, string> = new Map(); // In-memory cache for image data

  /**
   * Gets the storage key for a specific project's feature types
   * @param projectId - The project ID
   * @returns The storage key
   */
  private getFeatureTypesKey(projectId: number): string {
    return `${STORAGE_KEYS.FEATURE_TYPES_PREFIX}_${projectId}`;
  }

  /**
   * Gets the file system directory path for storing images
   * @returns The directory path
   */
  private getImagesDirectory(): string {
    return `${FileSystem.cacheDirectory}feature_type_images/`;
  }

  /**
   * Gets the file system path for a specific image
   * @param imageName - The image name (derived from URL or feature name)
   * @returns The file path
   */
  private getImagePath(imageName: string): string {
    return `${this.getImagesDirectory()}${imageName}`;
  }

  /**
   * Ensures the images directory exists
   * @returns Promise that resolves when the directory exists
   */
  private async ensureImagesDirectory(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(this.getImagesDirectory());
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.getImagesDirectory(), { intermediates: true });
      console.log('Created feature type images directory');
    }
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

  /**
   * Generates a safe filename from a URL or feature name
   * @param url - The image URL or feature name
   * @returns A sanitized filename
   */
  private getImageFilename(url: string, featureName: string): string {
    // Try to extract a meaningful name from the URL path
    let filename;
    try {
      const urlObj = new URL(url);
      // Get the last part of the path
      const pathParts = urlObj.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      
      // If there's a filename with extension
      if (lastPart && lastPart.includes('.')) {
        filename = lastPart;
      } else {
        // Use feature name as a fallback
        filename = `${featureName.replace(/\s+/g, '_')}.png`;
      }
    } catch {
      // If URL parsing fails, use feature name
      filename = `${featureName.replace(/\s+/g, '_')}.png`;
    }
    
    // Ensure filename is safe by removing any remaining special characters
    return filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  }

  /**
   * Stores an image from a URL to local storage
   * @param url - The remote image URL
   * @param featureName - The feature name (used for fallback filename generation)
   * @returns Promise that resolves with the local URI for the stored image
   */
  async storeFeatureTypeImage(url: string, featureName: string): Promise<string> {
    try {
      // If we already have the URL cached in memory, return it
      if (this.imagesCache.has(url)) {
        return this.imagesCache.get(url)!;
      }

      await this.ensureImagesDirectory();
      const filename = this.getImageFilename(url, featureName);
      const localUri = this.getImagePath(filename);
      
      // Check if we already have the file
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) {
        console.log(`Image already exists locally at ${localUri}`);
        this.imagesCache.set(url, localUri);
        return localUri;
      }
      
      // Download the file
      console.log(`Downloading image from ${url} to ${localUri}`);
      const downloadResult = await FileSystem.downloadAsync(url, localUri);
      
      if (downloadResult.status === 200) {
        console.log(`Successfully downloaded image to ${localUri}`);
        this.imagesCache.set(url, localUri);
        return localUri;
      } else {
        throw new Error(`Failed to download image, status: ${downloadResult.status}`);
      }
    } catch (error) {
      console.error('Error storing feature type image:', error);
      // Return original URL as fallback
      return url;
    }
  }

  /**
   * Gets a locally stored image URI for a remote URL if available
   * @param url - The remote image URL
   * @param featureName - The feature name
   * @returns Promise that resolves with the local URI if available, or the original URL
   */
  async getFeatureTypeImage(url: string, featureName: string): Promise<string> {
    try {
      // If URL is already a local file, return it
      if (url.startsWith('file://')) {
        return url;
      }
      
      // Check in-memory cache first
      if (this.imagesCache.has(url)) {
        return this.imagesCache.get(url)!;
      }

      // Check if we have a local version
      const filename = this.getImageFilename(url, featureName);
      const localUri = this.getImagePath(filename);
      
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) {
        console.log(`Found cached image for ${featureName} at ${localUri}`);
        this.imagesCache.set(url, localUri);
        return localUri;
      }
      
      // If we're online, try to download and cache it
      try {
        const storedUri = await this.storeFeatureTypeImage(url, featureName);
        return storedUri;
      } catch {
        // If download fails, return original URL
        return url;
      }
    } catch (error) {
      console.error('Error getting feature type image:', error);
      return url; // Return original URL as fallback
    }
  }
}

export const featureTypeStorageService = new FeatureTypeStorageService(); 