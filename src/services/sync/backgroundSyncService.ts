import { biDirectionalSyncService } from './biDirectionalSyncService';
import { syncLogger } from '../logging/syncLogger';
import { AppState, AppStateStatus } from 'react-native';

class BackgroundSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private currentProjectId: number | null = null;
  private appState: AppStateStatus = 'active';
  private appStateSubscription: { remove: () => void } | null = null;

  constructor() {
    // Listen to app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (this.appState === 'active' && nextAppState === 'background') {
      // App is going to background, perform final sync
      this.syncBeforeClose();
    }
    this.appState = nextAppState;
  };

  /**
   * Starts the background sync service for a specific project
   * @param projectId - The project ID to sync
   */
  start(projectId: number) {
    this.currentProjectId = projectId;
    this.syncInterval = setInterval(() => this.autoSync(), this.SYNC_INTERVAL);
    
    // Initial sync
    this.autoSync();
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
   * Performs an automatic sync if conditions are met
   */
  private async autoSync() {
    if (!this.currentProjectId) return;
    
    try {
      await syncLogger.logSyncOperation('auto_sync_start', this.currentProjectId, {
        timestamp: new Date().toISOString()
      });

      const online = await biDirectionalSyncService.isOnline();
      if (!online) {
        await syncLogger.logSyncOperation('auto_sync_offline', this.currentProjectId, {
          error: 'Device is offline'
        });
        return;
      }

      const result = await biDirectionalSyncService.syncProject(this.currentProjectId);
      
      await syncLogger.logSyncOperation('auto_sync_complete', this.currentProjectId, {
        result
      });
    } catch (error) {
      await syncLogger.logSyncOperation('auto_sync_error', this.currentProjectId, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Performs a sync before the app closes
   */
  private async syncBeforeClose() {
    if (!this.currentProjectId) return;

    try {
      await syncLogger.logSyncOperation('close_sync_start', this.currentProjectId, {
        timestamp: new Date().toISOString()
      });

      const online = await biDirectionalSyncService.isOnline();
      if (!online) {
        await syncLogger.logSyncOperation('close_sync_offline', this.currentProjectId, {
          error: 'Device is offline'
        });
        return;
      }

      const result = await biDirectionalSyncService.syncProject(this.currentProjectId);
      
      await syncLogger.logSyncOperation('close_sync_complete', this.currentProjectId, {
        result
      });
    } catch (error) {
      await syncLogger.logSyncOperation('close_sync_error', this.currentProjectId, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
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