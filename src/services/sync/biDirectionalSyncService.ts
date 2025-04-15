import { api } from '@/api/clients';
import { API_ENDPOINTS } from '@/api/endpoints';
import { projectStorageService } from '../storage/projectStorageService';
import { syncService } from './syncService';
import { collectedFeatureService } from '../features/collectedFeatureService';
import NetInfo from '@react-native-community/netinfo';
import { PointCollected } from '@/types/pointCollected.types';
import { generateId } from '@/utils/collections';
import { ApiFeature } from '@/types/currentFeatures.types';
import { syncLogger } from '../logging/syncLogger';
import { backupService } from '@/services/storage/backupService';
import { ProjectId, toProjectIdNumber, toProjectIdString } from '@/utils/projectId';

/**
 * Interface representing the result of a bi-directional sync operation
 */
export interface BiDirectionalSyncResult {
  success: boolean;
  localToServerSynced: number;
  serverToLocalSynced: number;
  failedCount: number;
  errorMessage?: string;
}

/**
 * Service for handling bi-directional syncing between local storage and server
 */
class BiDirectionalSyncService {
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 second
  private readonly MAX_RETRY_DELAY = 30000; // 30 seconds

  /**
   * Checks if the device is online
   */
  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
  }

  /**
   * Initializes project data when first loading a project
   */
  async initializeProject(projectId: ProjectId): Promise<void> {
    const projectIdStr = toProjectIdString(projectId);
    const existingData = await projectStorageService.getProjectData(projectIdStr);
    if (!existingData) {
      // First time loading this project
      const initialData = {
        points: [],
        lines: [],
        lastSync: new Date().toISOString(),
        isActive: true
      };
      await projectStorageService.saveProjectData(projectIdStr, initialData);
      await this.syncProject(projectId);
    }
  }

  private createPointCollected(feature: ApiFeature, projectIdNum: number): PointCollected {
    const firstPoint = feature.properties?.points?.[0];
    const coordinates = firstPoint?.coordinates || [0, 0];
    const [longitude, latitude] = coordinates;

    const nmeaData = firstPoint?.attributes?.nmeaData || {
      gga: {
        latitude,
        longitude,
        altitude: firstPoint?.altitude || 0,
        altitudeUnit: 'M',
        geoidHeight: 0,
        geoidHeightUnit: 'M',
        hdop: 0,
        quality: 0,
        satellites: 0,
        time: new Date().toISOString()
      },
      gst: {
        latitudeError: 0,
        longitudeError: 0,
        heightError: 0,
        time: new Date().toISOString(),
        rmsTotal: 0,
        semiMajor: 0,
        semiMinor: 0,
        orientation: 0
      }
    };

    return {
      client_id: feature.properties?.client_id || generateId(),
      name: feature.featureType?.name || 'Unknown Feature',
      description: feature.featureType?.description || 'No description available',
      draw_layer: feature.data?.draw_layer || feature.featureType?.draw_layer || 'default',
      nmeaData,
      attributes: {
        featureTypeName: feature.featureType?.name || 'Unknown Feature'
      },
      created_by: feature.created_by?.toString() || '1',
      created_at: feature.created_at || new Date().toISOString(),
      updated_at: feature.updated_at || new Date().toISOString(),
      updated_by: feature.updated_by?.toString() || '1',
      synced: true,
      feature_id: Number(feature.featureTypeId) || 0,
      project_id: projectIdNum
    };
  }

  /**
   * Syncs features from the server to local storage for a specific project
   */
  async syncFromServerToLocal(projectId: ProjectId): Promise<number> {
    const projectIdStr = toProjectIdString(projectId);
    const projectIdNum = toProjectIdNumber(projectId);
    
    const projectData = await projectStorageService.getProjectData(projectIdStr);
    if (!projectData) return 0;

    const activeFeatures = await collectedFeatureService.fetchActiveFeatures(projectIdNum);
    const existingPoints = projectData.points;
    const existingPointMap = new Map(
      existingPoints.map(point => [point.client_id, point])
    );

    const newFeatures: PointCollected[] = [];
    const updatedFeatures: PointCollected[] = [];

    for (const feature of activeFeatures) {
      const pointCollected = this.createPointCollected(feature, projectIdNum);
      const existingPoint = existingPointMap.get(pointCollected.client_id);

      if (!existingPoint) {
        newFeatures.push(pointCollected);
      } else {
        const serverUpdatedAt = new Date(feature.updated_at || '').getTime();
        const localUpdatedAt = new Date(existingPoint.updated_at).getTime();

        if (serverUpdatedAt > localUpdatedAt) {
          updatedFeatures.push(pointCollected);
        }
      }
    }

    // Update project data
    projectData.points = [
      ...existingPoints.filter(p => !newFeatures.some(nf => nf.client_id === p.client_id)),
      ...newFeatures,
      ...updatedFeatures
    ];
    projectData.lastSync = new Date().toISOString();
    await projectStorageService.saveProjectData(projectIdStr, projectData);

    return newFeatures.length + updatedFeatures.length;
  }

  /**
   * Performs a complete bi-directional sync for a specific project
   */
  async syncProject(projectId: ProjectId): Promise<BiDirectionalSyncResult> {
    const projectIdStr = toProjectIdString(projectId);
    const projectIdNum = toProjectIdNumber(projectId);
    
    try {
      await syncLogger.logSyncOperation('sync_start', projectIdNum, {
        timestamp: new Date().toISOString()
      });

      // Check if online
      const online = await this.isOnline();
      if (!online) {
        await syncLogger.logSyncOperation('sync_offline', projectIdNum, {
          error: 'Device is offline'
        });
        return {
          success: false,
          localToServerSynced: 0,
          serverToLocalSynced: 0,
          failedCount: 0,
          errorMessage: 'Device is offline'
        };
      }

      const projectData = await projectStorageService.getProjectData(projectIdStr);
      if (!projectData) {
        return {
          success: false,
          localToServerSynced: 0,
          serverToLocalSynced: 0,
          failedCount: 0,
          errorMessage: 'Project data not found'
        };
      }

      // Create backup before sync
      await backupService.createBackup(projectData.points, projectId);

      // Step 1: Sync from local to server
      const localToServerResult = await syncService.syncPoints(projectIdNum);

      // Step 2: Sync from server to local
      const serverToLocalSynced = await this.syncFromServerToLocal(projectId);

      const result = {
        success: localToServerResult.success,
        localToServerSynced: localToServerResult.syncedCount,
        serverToLocalSynced,
        failedCount: localToServerResult.failedCount,
        errorMessage: localToServerResult.errorMessage
      };

      await syncLogger.logSyncOperation('sync_complete', projectIdNum, {
        result
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await syncLogger.logSyncOperation('sync_error', projectIdNum, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      // Attempt to restore from backup if sync failed
      try {
        const backups = await backupService.getBackupsForProject(projectId);
        if (backups.length > 0) {
          const backupData = await backupService.restoreFromBackup(backups[0].timestamp, projectId);
          // Update project data with backup
          const currentData = await projectStorageService.getProjectData(projectIdStr);
          if (currentData) {
            currentData.points = backupData.points;
            await projectStorageService.saveProjectData(projectIdStr, currentData);
          }
        }
      } catch (restoreError) {
        console.error('Failed to restore from backup:', restoreError);
      }

      return {
        success: false,
        localToServerSynced: 0,
        serverToLocalSynced: 0,
        failedCount: 0,
        errorMessage
      };
    }
  }

  /**
   * Updates project status and cleans up inactive projects
   */
  async updateProjectStatus(projectId: ProjectId, isActive: boolean): Promise<void> {
    const projectIdStr = toProjectIdString(projectId);
    await projectStorageService.updateProjectStatus(projectIdStr, isActive);
    if (!isActive) {
      await projectStorageService.deleteProjectData(projectIdStr);
    }
  }

  /**
   * Updates list of active projects
   */
  async updateActiveProjects(activeProjectIds: ProjectId[]): Promise<void> {
    const projectIdsStr = activeProjectIds.map(toProjectIdString);
    await projectStorageService.updateActiveProjectIds(projectIdsStr);
    await projectStorageService.cleanupInactiveProjects();
  }
}

export const biDirectionalSyncService = new BiDirectionalSyncService(); 