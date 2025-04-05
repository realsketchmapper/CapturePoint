import AsyncStorage from '@react-native-async-storage/async-storage';
import { PointCollected } from '@/types/pointCollected.types';

/**
 * Storage keys used for AsyncStorage
 */
const STORAGE_KEYS = {
  COLLECTED_POINTS: 'PointsCollected',
} as const;

/**
 * Service for managing collected points in local storage
 * Provides methods for CRUD operations on collected points
 */
class StorageService {
  /**
   * Saves a collected point to local storage
   * @param point - The point to save
   * @throws Error if saving fails
   */
  async savePoint(point: PointCollected): Promise<void> {
    try {
      const points = await this.getAllPoints();
      points.push(point);
      await AsyncStorage.setItem(STORAGE_KEYS.COLLECTED_POINTS, JSON.stringify(points));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error saving point: ${error.message}`);
      }
      throw new Error('An unknown error occurred while saving point');
    }
  }

  /**
   * Updates an existing point in local storage
   * @param point - The updated point
   * @throws Error if updating fails
   */
  async updatePoint(point: PointCollected): Promise<void> {
    try {
      const points = await this.getAllPoints();
      const updatedPoints = points.map(p => p.client_id === point.client_id ? point : p);
      await AsyncStorage.setItem(STORAGE_KEYS.COLLECTED_POINTS, JSON.stringify(updatedPoints));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error updating point: ${error.message}`);
      }
      throw new Error('An unknown error occurred while updating point');
    }
  }

  /**
   * Retrieves all collected points from local storage
   * @returns Array of collected points
   */
  async getAllPoints(): Promise<PointCollected[]> {
    try {
      const pointsJson = await AsyncStorage.getItem(STORAGE_KEYS.COLLECTED_POINTS);
      return pointsJson ? JSON.parse(pointsJson) : [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Retrieves all unsynced points from local storage
   * @returns Array of unsynced points
   */
  async getUnsyncedPoints(): Promise<PointCollected[]> {
    try {
      const points = await this.getAllPoints();
      return points.filter(point => !point.synced);
    } catch (error) {
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
      return [];
    }
  }

  /**
   * Marks specified points as synced in local storage
   * @param pointIds - Array of point IDs to mark as synced
   * @throws Error if marking points as synced fails
   */
  async markPointsAsSynced(pointIds: string[]): Promise<void> {
    try {
      const points = await this.getAllPoints();
      const updatedPoints = points.map(point => 
        pointIds.includes(point.client_id) ? { ...point, synced: true } : point
      );
      await AsyncStorage.setItem(STORAGE_KEYS.COLLECTED_POINTS, JSON.stringify(updatedPoints));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error marking points as synced: ${error.message}`);
      }
      throw new Error('An unknown error occurred while marking points as synced');
    }
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
      
      await AsyncStorage.setItem(STORAGE_KEYS.COLLECTED_POINTS, JSON.stringify(filteredPoints));
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clears all points from local storage
   * @throws Error if clearing points fails
   */
  async clearAllPoints(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.COLLECTED_POINTS);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error clearing points: ${error.message}`);
      }
      throw new Error('An unknown error occurred while clearing points');
    }
  }
}

export const storageService = new StorageService(); 