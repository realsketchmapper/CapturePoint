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
   * Invalidates the cache for a specific project
   * @param projectId - The project ID
   */
  private invalidateCache(projectId: number): void {
    this.featuresCache.delete(projectId);
    console.log(`Cache invalidated for project ID: ${projectId}`);
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
      
      // Check if this is a line point
      const isLinePoint = point.attributes?.isLinePoint === true;
      const parentLineId = point.attributes?.parentLineId;
      
      // If this is a line point, find the parent line feature
      if (isLinePoint && parentLineId) {
        console.log(`Point ${point.client_id} is a line point for line ${parentLineId}`);
        
        // Find the parent line feature
        const lineFeatureIndex = features.findIndex(f => f.client_id === parentLineId);
        
        if (lineFeatureIndex >= 0) {
          // Update existing line feature
          console.log(`Found parent line feature at index ${lineFeatureIndex}`);
          const lineFeature = features[lineFeatureIndex];
          
          // Check if the point already exists in the line
          const existingPointIndex = lineFeature.points.findIndex(p => p.client_id === point.client_id);
          
          if (existingPointIndex >= 0) {
            // Update existing point
            lineFeature.points[existingPointIndex] = point;
          } else {
            // Add new point to line
            lineFeature.points.push(point);
          }
          
          // Sort points by their index to maintain line order
          lineFeature.points.sort((a, b) => 
            (a.attributes?.pointIndex || 0) - (b.attributes?.pointIndex || 0)
          );
          
          // Update line feature in the array
          features[lineFeatureIndex] = {
            ...lineFeature,
            updated_at: point.updated_at
          };
          
          console.log(`Updated line feature ${parentLineId} with point ${point.client_id}`);
          await this._saveFeaturesToStorage(point.project_id, features);
          this.invalidateCache(point.project_id);
        } else {
          console.warn(`Parent line feature ${parentLineId} not found for point ${point.client_id}`);
        }
        return;
      }
      
      // Only proceed with standalone point storage if it's not a line point
      if (!isLinePoint) {
        let updatedFeatures: CollectedFeature[];
        const existingIndex = features.findIndex(f => f.client_id === point.client_id);
        
        if (existingIndex >= 0) {
          // Update existing feature
          const existingFeature = features[existingIndex];
          updatedFeatures = [
            ...features.slice(0, existingIndex),
            {
              ...existingFeature,
              type: 'Point' as const,
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
            type: 'Point' as const,
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
        // Invalidate cache after saving
        this.invalidateCache(point.project_id);
        console.log('Point saved successfully');
      }
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
      const storageKey = this.getProjectKey(projectId);
      await AsyncStorage.setItem(storageKey, JSON.stringify([]));
      
      // Invalidate cache when clearing project features
      this.invalidateCache(projectId);
      
      console.log(`Cleared features for project ${projectId}`);
    }, 'clearing project features');
  }

  /**
   * Save a list of features for a project
   * @param projectId - The project ID
   * @param features - Array of features to save
   */
  async saveFeatures(projectId: number, features: CollectedFeature[]): Promise<void> {
    return this._withRetry(async () => {
      // Get existing features
      const existingFeatures = await this.getFeaturesForProject(projectId);
      
      // Process each new feature
      const updatedFeatures = features.map(newFeature => {
        // Check if this feature already exists
        const existingIndex = existingFeatures.findIndex(f => f.client_id === newFeature.client_id);
        
        if (existingIndex >= 0) {
          // Update existing feature
          return {
            ...existingFeatures[existingIndex],
            ...newFeature,
            // Preserve existing points if not provided in new feature
            points: newFeature.points.length > 0 ? newFeature.points : existingFeatures[existingIndex].points
          };
        }
        
        // For new features, ensure they have the correct structure
        return {
          ...newFeature,
          // Ensure type is properly set
          type: newFeature.type || 'Point',
          // Ensure points array exists
          points: newFeature.points || [],
          // Ensure attributes exist
          attributes: newFeature.attributes || {}
        };
      });
      
      // Merge with existing features that weren't updated
      const finalFeatures = [
        ...existingFeatures.filter(f => !features.some(newF => newF.client_id === f.client_id)),
        ...updatedFeatures
      ];
      
      await this._saveFeaturesToStorage(projectId, finalFeatures);
      this.invalidateCache(projectId);
    }, 'saving features');
  }

  /**
   * Save features to AsyncStorage
   * @param projectId - The project ID
   * @param features - Array of features to save
   * @private
   */
  private async _saveFeaturesToStorage(projectId: number, features: CollectedFeature[]): Promise<void> {
    const storageKey = this.getProjectKey(projectId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(features));
    
    // Update cache with the new data
    this.featuresCache.set(projectId, features);
    this.cacheTimestamp = Date.now();
    console.log(`Saved ${features.length} features to storage and updated cache`);
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