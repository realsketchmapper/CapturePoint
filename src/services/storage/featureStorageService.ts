import AsyncStorage from '@react-native-async-storage/async-storage';
import { PointCollected } from '@/types/pointCollected.types';
import { CollectedFeature } from '@/types/currentFeatures.types';
import { STORAGE_KEYS } from '@/constants/storage';

/**
 * Service for managing collected features (points and lines) in local storage
 * Provides methods for CRUD operations on collected features
 * 
 * Performance considerations:
 * - Uses in-memory caching to reduce AsyncStorage operations
 * - Batch operations for better performance with large datasets
 * - Standardized error handling across all methods
 * - Retry mechanism for critical operations
 */
class FeatureStorageService {
  // In-memory cache to reduce AsyncStorage operations
  private featuresCache: Map<number, CollectedFeature[]> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache TTL
  
  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  /**
   * Gets the storage key for a specific project
   * @param projectId - The project ID
   * @returns The storage key
   */
  private getProjectKey(projectId: number): string {
    return `${STORAGE_KEYS.COLLECTED_FEATURES}_${projectId}`;
  }

  /**
   * Saves a point to local storage
   * @param point - The point to save
   * @throws Error if saving fails after retries
   */
  async savePoint(point: PointCollected): Promise<void> {
    return this._withRetry(async () => {
      console.log('Saving point:', point.client_id);
      const features = await this.getFeaturesForProject(point.project_id);
      console.log('Current features in storage:', features.length);
      
      // Check if feature already exists
      const existingIndex = features.findIndex(f => f.client_id === point.client_id);
      
      let updatedFeatures: CollectedFeature[];
      if (existingIndex >= 0) {
        // Update existing feature
        const existingFeature = features[existingIndex];
        updatedFeatures = [
          ...features.slice(0, existingIndex),
          {
            ...existingFeature,
            points: [point],
            updated_at: point.updated_at,
            updated_by: Number(point.updated_by)
          },
          ...features.slice(existingIndex + 1)
        ];
      } else {
        // Add new feature
        updatedFeatures = [...features, {
          name: point.name,
          draw_layer: point.draw_layer,
          client_id: point.client_id,
          project_id: point.project_id,
          points: [point],
          attributes: point.attributes || {},
          is_active: true,
          created_by: Number(point.created_by),
          created_at: point.created_at,
          updated_by: Number(point.updated_by),
          updated_at: point.updated_at
        }];
      }
      
      console.log('Saving updated features:', updatedFeatures.length);
      await this._saveFeaturesToStorage(point.project_id, updatedFeatures);
      console.log('Point saved successfully');
    }, 'saving point');
  }

 

  /**
   * Updates a feature in local storage
   * @param feature - The updated feature
   * @throws Error if updating fails after retries
   */
  async updateFeature(feature: CollectedFeature): Promise<void> {
    return this._withRetry(async () => {
      const features = await this.getFeaturesForProject(feature.project_id);
      const updatedFeatures = features.map(f => 
        f.client_id === feature.client_id ? feature : f
      );
      await this._saveFeaturesToStorage(feature.project_id, updatedFeatures);
    }, 'updating feature');
  }

  /**
   * Retrieves all features for a specific project
   * @param projectId - The project ID
   * @returns Array of features
   */
  async getFeaturesForProject(projectId: number): Promise<CollectedFeature[]> {
    try {
      console.log('Getting features for project:', projectId);
      
      // Check if cache is valid
      const cachedFeatures = this.featuresCache.get(projectId);
      if (cachedFeatures && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
        console.log('Returning cached features:', cachedFeatures.length);
        return cachedFeatures;
      }

      // Cache miss or expired, fetch from storage
      const storageKey = this.getProjectKey(projectId);
      console.log('Fetching from storage with key:', storageKey);
      const featuresJson = await AsyncStorage.getItem(storageKey);
      const features = featuresJson ? JSON.parse(featuresJson) : [];
      
      console.log('Features loaded from storage:', features.length);
      
      // Update cache
      this.featuresCache.set(projectId, features);
      this.cacheTimestamp = Date.now();
      
      return features;
    } catch (error) {
      console.error('Error getting features for project:', error);
      return [];
    }
  }

  /**
   * Retrieves all unsynced features for a specific project
   * @param projectId - The project ID
   * @returns Array of unsynced features
   */
  async getUnsyncedFeatures(projectId: number): Promise<CollectedFeature[]> {
    try {
      const features = await this.getFeaturesForProject(projectId);
      return features.filter(feature => 
        feature.points.some(point => !point.synced)
      );
    } catch (error) {
      console.error('Error getting unsynced features:', error);
      return [];
    }
  }

  /**
   * Marks specified points as synced in local storage
   * @param pointIds - Array of point IDs to mark as synced
   * @param projectId - The project ID
   * @throws Error if marking points as synced fails after retries
   */
  async markPointsAsSynced(pointIds: string[], projectId: number): Promise<void> {
    return this._withRetry(async () => {
      const features = await this.getFeaturesForProject(projectId);
      const updatedFeatures = features.map(feature => ({
        ...feature,
        points: feature.points.map(point => 
          pointIds.includes(point.client_id) ? { ...point, synced: true } : point
        )
      }));
      await this._saveFeaturesToStorage(projectId, updatedFeatures);
    }, 'marking points as synced');
  }

  /**
   * Deletes a feature from local storage
   * @param featureId - The ID of the feature to delete
   * @param projectId - The project ID
   * @returns Boolean indicating if the feature was found and deleted
   */
  async deleteFeature(featureId: string, projectId: number): Promise<boolean> {
    try {
      const features = await this.getFeaturesForProject(projectId);
      const filteredFeatures = features.filter(f => f.client_id !== featureId);
      
      if (features.length === filteredFeatures.length) {
        return false; // Feature not found
      } 
      
      await this._saveFeaturesToStorage(projectId, filteredFeatures);
      return true;
    } catch (error) {
      console.error('Error deleting feature:', error);
      return false;
    }
  }

  /**
   * Clears all features for a specific project
   * @param projectId - The project ID
   * @throws Error if clearing features fails after retries
   */
  async clearProjectFeatures(projectId: number): Promise<void> {
    return this._withRetry(async () => {
      console.log('Clearing features for project:', projectId);
      const storageKey = this.getProjectKey(projectId);
      console.log('Removing storage key:', storageKey);
      await AsyncStorage.removeItem(storageKey);
      
      // Clear cache
      this.featuresCache.clear(); // Clear entire cache instead of just one project
      this.cacheTimestamp = 0;
      console.log('Storage and cache cleared');
    }, 'clearing features');
  }

  /**
   * Helper method to save features to storage and update cache
   * @param projectId - The project ID
   * @param features - Array of features to save
   * @private
   */
  private async _saveFeaturesToStorage(projectId: number, features: CollectedFeature[]): Promise<void> {
    await AsyncStorage.setItem(this.getProjectKey(projectId), JSON.stringify(features));
    // Update cache
    this.featuresCache.set(projectId, features);
    this.cacheTimestamp = Date.now();
  }

  /**
   * Executes an operation with retry logic
   * @param operation - The async operation to execute
   * @param operationName - Name of the operation for error messages
   * @private
   */
  private async _withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: unknown;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt} failed for ${operationName}:`, error);
        
        if (attempt < this.MAX_RETRIES) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt));
        }
      }
    }
    
    // All retries failed
    throw new Error(`Failed to ${operationName} after ${this.MAX_RETRIES} attempts: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
  }
}

export const featureStorageService = new FeatureStorageService(); 