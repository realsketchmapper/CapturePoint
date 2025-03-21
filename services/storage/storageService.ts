// services/storage/storageService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PointCollected } from '@/types/pointCollected.types';
import { STORAGE_KEYS } from '@/constants/storage';

interface SyncMetadata {
  lastSyncTime: string;
  activeProjects: number[];
  projectSyncTimes: Record<number, string>; // projectId -> last sync time
}

export const storageService = {
  // Project management
  addActiveProject: async (projectId: number): Promise<void> => {
    try {
      const activeProjects = await storageService.getActiveProjects();
      if (!activeProjects.includes(projectId)) {
        activeProjects.push(projectId);
        await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECTS, JSON.stringify(activeProjects));
      }
    } catch (error) {
      console.error('Error adding active project:', error);
      throw error;
    }
  },

  removeActiveProject: async (projectId: number): Promise<void> => {
    try {
      const activeProjects = await storageService.getActiveProjects();
      const updatedProjects = activeProjects.filter(id => id !== projectId);
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECTS, JSON.stringify(updatedProjects));
      
      // Clean up project data if it exists
      const projectKey = `${STORAGE_KEYS.PROJECT_POINTS_PREFIX}${projectId}`;
      const projectData = await AsyncStorage.getItem(projectKey);
      if (projectData) {
        await AsyncStorage.removeItem(projectKey);
      }
    } catch (error) {
      console.error('Error removing active project:', error);
      throw error;
    }
  },

  getActiveProjects: async (): Promise<number[]> => {
    try {
      const projectsJson = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_PROJECTS);
      return projectsJson ? JSON.parse(projectsJson) : [];
    } catch (error) {
      console.error('Error getting active projects:', error);
      return [];
    }
  },

  // Point management
  savePoint: async (point: PointCollected): Promise<void> => {
    try {
      const projectKey = `${STORAGE_KEYS.PROJECT_POINTS_PREFIX}${point.projectId}`;
      const pointsJson = await AsyncStorage.getItem(projectKey);
      const points: PointCollected[] = pointsJson ? JSON.parse(pointsJson) : [];
      
      points.push(point);
      await AsyncStorage.setItem(projectKey, JSON.stringify(points));
      
      // Add project to active projects if not already there
      await storageService.addActiveProject(point.projectId);
      
      console.log(`Point saved locally with ID: ${point.id} for project: ${point.projectId}`);
    } catch (error) {
      console.error('Error saving point:', error);
      throw error;
    }
  },

  getProjectPoints: async (projectId: number): Promise<PointCollected[]> => {
    try {
      const projectKey = `${STORAGE_KEYS.PROJECT_POINTS_PREFIX}${projectId}`;
      const pointsJson = await AsyncStorage.getItem(projectKey);
      return pointsJson ? JSON.parse(pointsJson) : [];
    } catch (error) {
      console.error(`Error getting points for project ${projectId}:`, error);
      return [];
    }
  },

  getAllPoints: async (): Promise<PointCollected[]> => {
    try {
      const activeProjects = await storageService.getActiveProjects();
      let allPoints: PointCollected[] = [];
      
      for (const projectId of activeProjects) {
        const projectPoints = await storageService.getProjectPoints(projectId);
        allPoints = allPoints.concat(projectPoints);
      }
      
      return allPoints;
    } catch (error) {
      console.error('Error getting all points:', error);
      return [];
    }
  },

  getUnsyncedPoints: async (): Promise<PointCollected[]> => {
    try {
      const allPoints = await storageService.getAllPoints();
      return allPoints.filter(point => !point.synced);
    } catch (error) {
      console.error('Error getting unsynced points:', error);
      return [];
    }
  },

  getUnsyncedPointsForProject: async (projectId: number): Promise<PointCollected[]> => {
    try {
      const projectPoints = await storageService.getProjectPoints(projectId);
      return projectPoints.filter(point => !point.synced);
    } catch (error) {
      console.error(`Error getting unsynced points for project ${projectId}:`, error);
      return [];
    }
  },

  markPointsAsSynced: async (pointIds: string[], projectId: number): Promise<void> => {
    try {
      const projectPoints = await storageService.getProjectPoints(projectId);
      const updatedPoints = projectPoints.map(point => 
        pointIds.includes(point.id) ? { ...point, synced: true } : point
      );
      
      const projectKey = `${STORAGE_KEYS.PROJECT_POINTS_PREFIX}${projectId}`;
      await AsyncStorage.setItem(projectKey, JSON.stringify(updatedPoints));
      
      // Update sync metadata
      await storageService.updateSyncMetadata(projectId);
    } catch (error) {
      console.error('Error marking points as synced:', error);
      throw error;
    }
  },

  deletePoint: async (pointId: string, projectId: number): Promise<boolean> => {
    try {
      const projectPoints = await storageService.getProjectPoints(projectId);
      const filteredPoints = projectPoints.filter(point => point.id !== pointId);
      
      if (projectPoints.length === filteredPoints.length) {
        return false; // Point not found
      }
      
      const projectKey = `${STORAGE_KEYS.PROJECT_POINTS_PREFIX}${projectId}`;
      await AsyncStorage.setItem(projectKey, JSON.stringify(filteredPoints));
      return true;
    } catch (error) {
      console.error('Error deleting point:', error);
      return false;
    }
  },

  // Sync metadata management
  getSyncMetadata: async (): Promise<SyncMetadata> => {
    try {
      const metadataJson = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_METADATA);
      return metadataJson ? JSON.parse(metadataJson) : {
        lastSyncTime: '',
        activeProjects: [],
        projectSyncTimes: {}
      };
    } catch (error) {
      console.error('Error getting sync metadata:', error);
      return {
        lastSyncTime: '',
        activeProjects: [],
        projectSyncTimes: {}
      };
    }
  },

  updateSyncMetadata: async (projectId: number): Promise<void> => {
    try {
      const metadata = await storageService.getSyncMetadata();
      const now = new Date().toISOString();
      
      metadata.lastSyncTime = now;
      metadata.projectSyncTimes[projectId] = now;
      
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_METADATA, JSON.stringify(metadata));
    } catch (error) {
      console.error('Error updating sync metadata:', error);
      throw error;
    }
  },

  // Clear all data for testing/debugging
  clearAllData: async (): Promise<void> => {
    try {
      const activeProjects = await storageService.getActiveProjects();
      
      // Clear all project data
      for (const projectId of activeProjects) {
        const projectKey = `${STORAGE_KEYS.PROJECT_POINTS_PREFIX}${projectId}`;
        await AsyncStorage.removeItem(projectKey);
      }
      
      // Clear metadata
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECTS);
      await AsyncStorage.removeItem(STORAGE_KEYS.SYNC_METADATA);
      
      console.log('Cleared all data from local storage');
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  },

  // Get a point by its ID
  getPointById: async (pointId: string): Promise<PointCollected | null> => {
    try {
      const points = await storageService.getAllPoints();
      return points.find(p => p.id === pointId) || null;
    } catch (error) {
      console.error('Error getting point by ID:', error);
      return null;
    }
  },

  // Update an existing point with partial or complete data
  updatePoint: async (pointId: string | PointCollected, updatedData?: Partial<PointCollected>): Promise<boolean> => {
    try {
      // If first argument is a complete point object
      if (typeof pointId === 'object') {
        const point = pointId;
        const projectKey = `${STORAGE_KEYS.PROJECT_POINTS_PREFIX}${point.projectId}`;
        const pointsJson = await AsyncStorage.getItem(projectKey);
        const points: PointCollected[] = pointsJson ? JSON.parse(pointsJson) : [];
        
        const updatedPoints = points.map(p => p.id === point.id ? point : p);
        await AsyncStorage.setItem(projectKey, JSON.stringify(updatedPoints));
        
        console.log(`Point updated locally with ID: ${point.id} for project: ${point.projectId}`);
        return true;
      }
      
      // If using pointId and partial update data
      if (typeof pointId === 'string' && updatedData) {
        const points = await storageService.getAllPoints();
        const existingPoint = points.find(p => p.id === pointId);
        
        if (!existingPoint) return false;
        
        const updatedPoint = { ...existingPoint, ...updatedData };
        const projectKey = `${STORAGE_KEYS.PROJECT_POINTS_PREFIX}${updatedPoint.projectId}`;
        const projectPoints = await storageService.getProjectPoints(updatedPoint.projectId);
        
        const updatedPoints = projectPoints.map(p => p.id === pointId ? updatedPoint : p);
        await AsyncStorage.setItem(projectKey, JSON.stringify(updatedPoints));
        
        console.log(`Point updated locally with ID: ${pointId} for project: ${updatedPoint.projectId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating point:', error);
      return false;
    }
  },

  // Add a new point
  addPoint: async (point: PointCollected): Promise<boolean> => {
    try {
      const projectKey = `${STORAGE_KEYS.PROJECT_POINTS_PREFIX}${point.projectId}`;
      const pointsJson = await AsyncStorage.getItem(projectKey);
      const points: PointCollected[] = pointsJson ? JSON.parse(pointsJson) : [];
      
      points.push(point);
      await AsyncStorage.setItem(projectKey, JSON.stringify(points));
      
      // Add project to active projects if not already there
      await storageService.addActiveProject(point.projectId);
      
      console.log(`Point added locally with ID: ${point.id} for project: ${point.projectId}`);
      return true;
    } catch (error) {
      console.error('Error adding point:', error);
      return false;
    }
  },

  // Clear all points for a specific project
  clearAllPoints: async (projectId: number, pointId?: string): Promise<void> => {
    try {
      console.log(`Clearing all points for project ${projectId}`);
      
      // Remove points for this project
      const projectKey = `${STORAGE_KEYS.PROJECT_POINTS_PREFIX}${projectId}`;
      await AsyncStorage.removeItem(projectKey);
      
      // Clear sync metadata for this project
      const syncMetadataJson = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_METADATA);
      if (syncMetadataJson) {
        const syncMetadata = JSON.parse(syncMetadataJson);
        if (syncMetadata.projectSyncTimes) {
          delete syncMetadata.projectSyncTimes[projectId];
          await AsyncStorage.setItem(STORAGE_KEYS.SYNC_METADATA, JSON.stringify(syncMetadata));
        }
      }
      
      // Clear last sync time for this project
      await AsyncStorage.removeItem(`${STORAGE_KEYS.LAST_SYNC_TIME}_${projectId}`);
      
      console.log(`✨ Successfully cleared all points and sync data for project ${projectId}`);
    } catch (error) {
      console.error('Error clearing points:', error);
      throw error;
    }
  }
};