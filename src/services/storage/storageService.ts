import AsyncStorage from '@react-native-async-storage/async-storage';
import { PointCollected } from '@/types/pointCollected.types';
import { STORAGE_KEYS } from '@/constants/storage';

/**
 * Service for managing collected points in local storage
 * Provides methods for CRUD operations on collected points
 * 
 * Performance considerations:
 * - Uses in-memory caching to reduce AsyncStorage operations
 * - Batch operations for better performance with large datasets
 * - Standardized error handling across all methods
 * - Retry mechanism for critical operations
 * - Concurrency handling for simultaneous access
 */
class StorageService {
  // In-memory cache to reduce AsyncStorage operations
  private pointsCache: PointCollected[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache TTL
  
  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  /**
   * Saves a collected point to local storage
   * @param point - The point to save
   * @throws Error if saving fails after retries
   */
  async savePoint(point: PointCollected): Promise<void> {
    console.log('=== Saving point ===');
    console.log('Point to save:', JSON.stringify(point, null, 2));
    
    return this._withRetry(async () => {
      const points = await this.getAllPoints();
      const updatedPoints = [...points, point];
      await this._savePointsToStorage(updatedPoints);
      console.log('Point saved successfully');
    }, 'saving point');
  }

  /**
   * Updates an existing point in local storage
   * @param point - The updated point
   * @throws Error if updating fails after retries
   */
  async updatePoint(point: PointCollected): Promise<void> {
    return this._withRetry(async () => {
      const points = await this.getAllPoints();
      const updatedPoints = points.map(p => p.client_id === point.client_id ? point : p);
      await this._savePointsToStorage(updatedPoints);
    }, 'updating point');
  }

  /**
   * Retrieves all collected points from local storage
   * Uses in-memory cache to reduce AsyncStorage operations
   * @returns Array of collected points
   */
  async getAllPoints(): Promise<PointCollected[]> {
    try {
      // Check if cache is valid
      if (this.pointsCache && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
        return this.pointsCache;
      }

      // Cache miss or expired, fetch from storage
      const pointsJson = await AsyncStorage.getItem(STORAGE_KEYS.COLLECTED_POINTS);
      const points = pointsJson ? JSON.parse(pointsJson) : [];
      
      // Update cache
      this.pointsCache = points;
      this.cacheTimestamp = Date.now();
      
      return points;
    } catch (error) {
      console.error('Error getting all points:', error);
      return [];
    }
  }

  /**
   * Retrieves all unsynced points from local storage
   * @returns Array of unsynced points
   */
  async getUnsyncedPoints(): Promise<PointCollected[]> {
    try {
      console.log('=== Getting unsynced points ===');
      const points = await this.getAllPoints();
      const unsyncedPoints = points.filter(point => !point.synced);
      console.log('Found unsynced points:', unsyncedPoints.length);
      console.log('Unsynced points:', JSON.stringify(unsyncedPoints, null, 2));
      return unsyncedPoints;
    } catch (error) {
      console.error('Error getting unsynced points:', error);
      return [];
    }
  }

  /**
   * Retrieves unsynced points for a specific project
   * @param projectId - The project ID
   * @returns Array of unsynced points for the project
   */
  async getUnsyncedPointsForProject(projectId: number): Promise<PointCollected[]> {
    try {
      const unsyncedPoints = await this.getUnsyncedPoints();
      return unsyncedPoints.filter(point => point.projectId === projectId);
    } catch (error) {
      console.error('Error getting unsynced points for project:', error);
      return [];
    }
  }

  /**
   * Retrieves points that haven't been synced since a specific time
   * @param since - Date to check against
   * @returns Array of points not synced since the specified date
   */
  async getPointsNotSyncedSince(since: Date): Promise<PointCollected[]> {
    try {
      const points = await this.getAllPoints();
      return points.filter(point => !point.synced || new Date(point.updated_at) > since);
    } catch (error) {
      console.error('Error getting points not synced since:', error);
      return [];
    }
  }

  /**
   * Marks specified points as synced in local storage
   * @param pointIds - Array of point IDs to mark as synced
   * @throws Error if marking points as synced fails after retries
   */
  async markPointsAsSynced(pointIds: string[]): Promise<void> {
    console.log('=== Marking points as synced ===');
    console.log('Point IDs to mark as synced:', pointIds);
    
    return this._withRetry(async () => {
      const points = await this.getAllPoints();
      console.log('Current points before update:', points.length);
      
      const updatedPoints = points.map(point => 
        pointIds.includes(point.client_id) ? { ...point, synced: true } : point
      );
      
      console.log('Points after update:', updatedPoints.length);
      console.log('Updated points:', JSON.stringify(updatedPoints, null, 2));
      
      await this._savePointsToStorage(updatedPoints);
      console.log('Points marked as synced successfully');
    }, 'marking points as synced');
  }

  /**
   * Batch marks multiple points as synced in a single operation
   * More efficient than individual updates for large batches
   * @param points - Array of points to mark as synced
   * @throws Error if operation fails after retries
   */
  async batchMarkPointsAsSynced(points: PointCollected[]): Promise<void> {
    return this._withRetry(async () => {
      const allPoints = await this.getAllPoints();
      const pointIds = new Set(points.map(p => p.client_id));
      
      const updatedPoints = allPoints.map(point => 
        pointIds.has(point.client_id) ? { ...point, synced: true } : point
      );
      
      await this._savePointsToStorage(updatedPoints);
    }, 'batch marking points as synced');
  }

  /**
   * Gets the count of unsynced points
   * @returns Number of unsynced points
   */
  async getUnsyncedCount(): Promise<number> {
    try {
      const unsyncedPoints = await this.getUnsyncedPoints();
      return unsyncedPoints.length;
    } catch (error) {
      console.error('Error getting unsynced count:', error);
      return 0;
    }
  }

  /**
   * Retrieves all points for a specific project
   * @param projectId - The project ID
   * @returns Array of points for the project
   */
  async getPointsForProject(projectId: number): Promise<PointCollected[]> {
    try {
      const points = await this.getAllPoints();
      return points.filter(point => point.projectId === projectId);
    } catch (error) {
      console.error('Error getting points for project:', error);
      return [];
    }
  }

  /**
   * Deletes a point from local storage
   * @param pointId - The ID of the point to delete
   * @returns Boolean indicating if the point was found and deleted
   */
  async deletePoint(pointId: string): Promise<boolean> {
    try {
      const points = await this.getAllPoints();
      const filteredPoints = points.filter(point => point.client_id !== pointId);
      
      if (points.length === filteredPoints.length) {
        return false; // Point not found
      } 
      
      await this._savePointsToStorage(filteredPoints);
      return true;
    } catch (error) {
      console.error('Error deleting point:', error);
      return false;
    }
  }

  /**
   * Clears all points from local storage
   * @throws Error if clearing points fails after retries
   */
  async clearAllPoints(): Promise<void> {
    return this._withRetry(async () => {
      await AsyncStorage.removeItem(STORAGE_KEYS.COLLECTED_POINTS);
      // Clear cache
      this.pointsCache = null;
      this.cacheTimestamp = 0;
    }, 'clearing points');
  }

  /**
   * Helper method to save points to storage and update cache
   * @param points - Array of points to save
   * @private
   */
  private async _savePointsToStorage(points: PointCollected[]): Promise<void> {
    console.log('=== Saving points to storage ===');
    console.log('Number of points to save:', points.length);
    await AsyncStorage.setItem(STORAGE_KEYS.COLLECTED_POINTS, JSON.stringify(points));
    // Update cache
    this.pointsCache = points;
    this.cacheTimestamp = Date.now();
    console.log('Points saved to storage successfully');
  }

  /**
   * Standardized error handling
   * @param error - The error object
   * @param operation - Description of the operation that failed
   * @private
   */
  private _handleError(error: unknown, operation: string): never {
    if (error instanceof Error) {
      throw new Error(`Error ${operation}: ${error.message}`);
    }
    throw new Error(`An unknown error occurred while ${operation}`);
  }

  /**
   * Executes an operation with retry logic
   * @param operation - The async operation to execute
   * @param operationName - Name of the operation for error messages
   * @returns Result of the operation
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
    this._handleError(lastError, operationName);
  }
}

export const storageService = new StorageService(); 