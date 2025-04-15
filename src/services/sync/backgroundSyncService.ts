import { biDirectionalSyncService } from './biDirectionalSyncService';
import { syncLogger } from '../logging/syncLogger';
import { AppState, AppStateStatus } from 'react-native';
import { projectStorageService } from '../storage/projectStorageService';
import { ProjectId, toProjectIdNumber, toProjectIdString } from '@/utils/projectId';

class BackgroundSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private currentProjectId: ProjectId | null = null;
  private appState: AppStateStatus = 'active';
  private appStateSubscription: { remove: () => void } | null = null;

  constructor() {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (this.appState === 'active' && nextAppState === 'background') {
      this.syncBeforeClose();
    }
    this.appState = nextAppState;
  };

  /**
   * Starts the background sync service for a specific project
   */
  async start(projectId: ProjectId) {
    this.currentProjectId = projectId;
    await biDirectionalSyncService.initializeProject(projectId);
    this.syncInterval = setInterval(() => this.autoSync(), this.SYNC_INTERVAL);
    await this.autoSync();
  }

  /**
   * Stops the background sync service
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.currentProjectId = null;
  }

  /**
   * Performs a sync operation with proper error handling and logging
   */
  private async performSync(operationType: 'auto' | 'close'): Promise<void> {
    if (!this.currentProjectId) return;

    const projectIdStr = toProjectIdString(this.currentProjectId);
    const projectIdNum = toProjectIdNumber(this.currentProjectId);
    
    try {
      const projectData = await projectStorageService.getProjectData(projectIdStr);
      if (!projectData || !projectData.isActive) {
        if (operationType === 'auto') this.stop();
        return;
      }

      await syncLogger.logSyncOperation(`${operationType}_sync_start`, projectIdNum, {
        timestamp: new Date().toISOString()
      });

      const online = await biDirectionalSyncService.isOnline();
      if (!online) {
        await syncLogger.logSyncOperation(`${operationType}_sync_offline`, projectIdNum, {
          error: 'Device is offline'
        });
        return;
      }

      const result = await biDirectionalSyncService.syncProject(this.currentProjectId);
      await syncLogger.logSyncOperation(`${operationType}_sync_complete`, projectIdNum, { result });
    } catch (error) {
      await syncLogger.logSyncOperation(`${operationType}_sync_error`, projectIdNum, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Performs an automatic sync if conditions are met
   */
  private async autoSync(): Promise<void> {
    await this.performSync('auto');
  }

  /**
   * Performs a sync before the app closes
   */
  private async syncBeforeClose(): Promise<void> {
    await this.performSync('close');
  }

  /**
   * Cleanup when the service is no longer needed
   */
  cleanup() {
    this.stop();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export const backgroundSyncService = new BackgroundSyncService(); 