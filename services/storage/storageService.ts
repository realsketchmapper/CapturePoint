// services/storage/storageService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PointCollected } from '@/types/pointCollected.types';

const STORAGE_KEYS = {
  COLLECTED_POINTS: 'PointsCollected',
};

export const storageService = {
  // Save a collected point to local storage
  savePoint: async (point: PointCollected): Promise<void> => {
    try {
      // Get existing points
      const pointsJson = await AsyncStorage.getItem(STORAGE_KEYS.COLLECTED_POINTS);
      const points: PointCollected[] = pointsJson ? JSON.parse(pointsJson) : [];
      
      // Add new point
      points.push(point);
      
      // Save updated list
      await AsyncStorage.setItem(STORAGE_KEYS.COLLECTED_POINTS, JSON.stringify(points));
      console.log(`Point saved locally with ID: ${point.id}`);
    } catch (error) {
      console.error('Error saving point:', error);
      throw error;
    }
  },
  
  // Update an existing point
  updatePoint: async (point: PointCollected): Promise<void> => {
    try {
      // Get existing points
      const pointsJson = await AsyncStorage.getItem(STORAGE_KEYS.COLLECTED_POINTS);
      const points: PointCollected[] = pointsJson ? JSON.parse(pointsJson) : [];
      
      // Find and update the point
      const updatedPoints = points.map(p => 
        p.id === point.id ? point : p
      );
      
      // Save updated list
      await AsyncStorage.setItem(STORAGE_KEYS.COLLECTED_POINTS, JSON.stringify(updatedPoints));
      console.log(`Point updated locally with ID: ${point.id}`);
    } catch (error) {
      console.error('Error updating point:', error);
      throw error;
    }
  },
  
  // Get all collected points
  getAllPoints: async (): Promise<PointCollected[]> => {
    try {
      const pointsJson = await AsyncStorage.getItem(STORAGE_KEYS.COLLECTED_POINTS);
      return pointsJson ? JSON.parse(pointsJson) : [];
    } catch (error) {
      console.error('Error getting points:', error);
      return [];
    }
  },
  
  // Get unsynced points
  getUnsyncedPoints: async (): Promise<PointCollected[]> => {
    try {
      const points = await storageService.getAllPoints();
      return points.filter(point => !point.synced);
    } catch (error) {
      console.error('Error getting unsynced points:', error);
      return [];
    }
  },
  
  // Get unsynced points for specific project
  getUnsyncedPointsForProject: async (projectId: number): Promise<PointCollected[]> => {
    try {
      const unsyncedPoints = await storageService.getUnsyncedPoints();
      return unsyncedPoints.filter(point => point.projectId === projectId);
    } catch (error) {
      console.error(`Error getting unsynced points for project ${projectId}:`, error);
      return [];
    }
  },
  
  // Mark points as synced
  markPointsAsSynced: async (pointIds: string[]): Promise<void> => {
    try {
      const points = await storageService.getAllPoints();
      
      const updatedPoints = points.map(point => {
        if (pointIds.includes(point.id)) {
          return { ...point, synced: true };
        }
        return point;
      });
      
      await AsyncStorage.setItem(STORAGE_KEYS.COLLECTED_POINTS, JSON.stringify(updatedPoints));
      console.log(`Marked ${pointIds.length} points as synced`);
    } catch (error) {
      console.error('Error marking points as synced:', error);
      throw error;
    }
  },
  
  // Get count of unsynced points
  getUnsyncedCount: async (): Promise<number> => {
    try {
      const unsyncedPoints = await storageService.getUnsyncedPoints();
      return unsyncedPoints.length;
    } catch (error) {
      console.error('Error getting unsynced count:', error);
      return 0;
    }
  },
  
  // Get points for a specific project
  getPointsForProject: async (projectId: number): Promise<PointCollected[]> => {
    try {
      const points = await storageService.getAllPoints();
      return points.filter(point => point.projectId === projectId);
    } catch (error) {
      console.error(`Error getting points for project ${projectId}:`, error);
      return [];
    }
  },
  
  // Delete a point
  deletePoint: async (pointId: string): Promise<boolean> => {
    try {
      const points = await storageService.getAllPoints();
      const filteredPoints = points.filter(point => point.id !== pointId);
      
      if (points.length === filteredPoints.length) {
        return false; // Point not found
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.COLLECTED_POINTS, JSON.stringify(filteredPoints));
      return true;
    } catch (error) {
      console.error('Error deleting point:', error);
      return false;
    }
  },
  
  // Clear all points from storage
  clearAllPoints: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.COLLECTED_POINTS);
      console.log('All points cleared from storage');
    } catch (error) {
      console.error('Error clearing points:', error);
      throw error;
    }
  },

  // Clear all data from AsyncStorage except location and token data
  clearAllData: async (): Promise<void> => {
    try {
      // Get all keys from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Keys to preserve
      const preserveKeys = [
        '@user_credentials',  // Token data
        'locationPermission', // Location permission
        'locationHighAccuracy' // Location accuracy setting
      ];
      
      // Filter out keys to preserve
      const keysToRemove = allKeys.filter(key => !preserveKeys.includes(key));
      
      // Remove all other keys
      await AsyncStorage.multiRemove(keysToRemove);
      
      console.log('All data cleared from AsyncStorage except location and token data');
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  }
};