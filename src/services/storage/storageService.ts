import AsyncStorage from '@react-native-async-storage/async-storage';
import { PointCollected } from '@/types/pointCollected.types';
import { LineCollected } from '@/types/lineCollected.types';
import { STORAGE_KEYS } from '@/constants/storage';

/**
 * Service for managing collected points and lines in local storage
 * Provides methods for CRUD operations on collected features
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
  private linesCache: LineCollected[] | null = null;
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
   * Saves a collected line to local storage
   * @param line - The line to save
   * @throws Error if saving fails after retries
   */
  async saveLine(line: LineCollected): Promise<void> {
    console.log('=== Saving line ===');
    console.log('Line to save:', JSON.stringify(line, null, 2));
    
    return this._withRetry(async () => {
      const lines = await this.getAllLines();
      const updatedLines = [...lines, line];
      await this._saveLinesToStorage(updatedLines);
      console.log('Line saved successfully');
    }, 'saving line');
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
   * Retrieves all collected lines from local storage
   * Uses in-memory cache to reduce AsyncStorage operations
   * @returns Array of collected lines
   */
  async getAllLines(): Promise<LineCollected[]> {
    try {
      // Check if cache is valid
      if (this.linesCache && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
        return this.linesCache;
      }

      // Cache miss or expired, fetch from storage
      const linesJson = await AsyncStorage.getItem(STORAGE_KEYS.COLLECTED_LINES);
      const lines = linesJson ? JSON.parse(linesJson) : [];
      
      // Update cache
      this.linesCache = lines;
      this.cacheTimestamp = Date.now();
      
      return lines;
    } catch (error) {
      console.error('Error getting all lines:', error);
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
   * Retrieves all unsynced lines from local storage
   * @returns Array of unsynced lines
   */
  async getUnsyncedLines(): Promise<LineCollected[]> {
    try {
      console.log('=== Getting unsynced lines ===');
      const lines = await this.getAllLines();
      const unsyncedLines = lines.filter(line => !line.synced);
      console.log('Found unsynced lines:', unsyncedLines.length);
      console.log('Unsynced lines:', JSON.stringify(unsyncedLines, null, 2));
      return unsyncedLines;
    } catch (error) {
      console.error('Error getting unsynced lines:', error);
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
      return unsyncedPoints.filter(point => point.project_id === projectId);
    } catch (error) {
      console.error('Error getting unsynced points for project:', error);
      return [];
    }
  }

  /**
   * Retrieves unsynced lines for a specific project
   * @param projectId - The project ID
   * @returns Array of unsynced lines for the project
   */
  async getUnsyncedLinesForProject(projectId: number): Promise<LineCollected[]> {
    try {
      const unsyncedLines = await this.getUnsyncedLines();
      return unsyncedLines.filter(line => line.project_id === projectId);
    } catch (error) {
      console.error('Error getting unsynced lines for project:', error);
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
      return points.filter(point => point.project_id === projectId);
    } catch (error) {
      console.error('Error getting points for project:', error);
      return [];
    }
  }

  /**
   * Retrieves all lines for a specific project
   * @param projectId - The project ID
   * @returns Array of lines for the project
   */
  async getLinesForProject(projectId: number): Promise<LineCollected[]> {
    try {
      const lines = await this.getAllLines();
      return lines.filter(line => line.project_id === projectId);
    } catch (error) {
      console.error('Error getting lines for project:', error);
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
    console.log('=== Clearing all points ===');
    return this._withRetry(async () => {
      await AsyncStorage.removeItem(STORAGE_KEYS.COLLECTED_POINTS);
      this.pointsCache = [];
      console.log('All points cleared successfully');
    }, 'clearing all points');
  }

  /**
   * Clears all lines from local storage
   * @throws Error if clearing lines fails after retries
   */
  async clearAllLines(): Promise<void> {
    console.log('=== Clearing all lines ===');
    return this._withRetry(async () => {
      await AsyncStorage.removeItem(STORAGE_KEYS.COLLECTED_LINES);
      this.linesCache = [];
      console.log('All lines cleared successfully');
    }, 'clearing all lines');
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
   * Helper method to save lines to storage and update cache
   * @param lines - Array of lines to save
   * @private
   */
  private async _saveLinesToStorage(lines: LineCollected[]): Promise<void> {
    console.log('=== Saving lines to storage ===');
    console.log('Number of lines to save:', lines.length);
    await AsyncStorage.setItem(STORAGE_KEYS.COLLECTED_LINES, JSON.stringify(lines));
    // Update cache
    this.linesCache = lines;
    this.cacheTimestamp = Date.now();
    console.log('Lines saved to storage successfully');
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