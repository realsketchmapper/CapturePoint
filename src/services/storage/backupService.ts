import AsyncStorage from '@react-native-async-storage/async-storage';
import { PointCollected } from '@/types/pointCollected.types';
import { syncLogger } from '../logging/syncLogger';

interface Backup {
  timestamp: string;
  points: PointCollected[];
  version: string;
  projectId: number;
  metadata: {
    pointCount: number;
    lastSyncTimestamp?: string;
  };
}

class BackupService {
  private static readonly BACKUP_KEY = '@points_backup';
  private static readonly MAX_BACKUPS = 5;
  private static readonly BACKUP_RETENTION_DAYS = 30;

  static async createBackup(points: PointCollected[], projectId: number): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const backup: Backup = {
        timestamp,
        points,
        version: '1.0',
        projectId,
        metadata: {
          pointCount: points.length,
          lastSyncTimestamp: new Date().toISOString()
        }
      };

      const existingBackups = await this.getBackups();
      const newBackups = [backup, ...existingBackups].slice(0, this.MAX_BACKUPS);

      await AsyncStorage.setItem(this.BACKUP_KEY, JSON.stringify(newBackups));
      
      await syncLogger.logSyncOperation('backup_created', projectId, {
        backupTimestamp: timestamp,
        pointCount: points.length
      });
    } catch (error) {
      console.error('Failed to create backup:', error);
      await syncLogger.logSyncOperation('backup_error', projectId, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async getBackups(): Promise<Backup[]> {
    try {
      const backupsJson = await AsyncStorage.getItem(this.BACKUP_KEY);
      if (!backupsJson) return [];

      const backups: Backup[] = JSON.parse(backupsJson);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.BACKUP_RETENTION_DAYS);

      // Filter out old backups
      return backups.filter(backup => new Date(backup.timestamp) > cutoffDate);
    } catch (error) {
      console.error('Failed to get backups:', error);
      return [];
    }
  }

  static async getBackupsForProject(projectId: number): Promise<Backup[]> {
    const backups = await this.getBackups();
    return backups.filter(backup => backup.projectId === projectId);
  }

  static async restoreFromBackup(backupTimestamp: string, projectId: number): Promise<boolean> {
    try {
      const backups = await this.getBackups();
      const backup = backups.find(b => 
        b.timestamp === backupTimestamp && b.projectId === projectId
      );
      
      if (!backup) {
        await syncLogger.logSyncOperation('backup_restore_failed', projectId, {
          error: 'Backup not found',
          backupTimestamp
        });
        return false;
      }

      // Restore points
      await AsyncStorage.setItem(
        `@project_${projectId}_points`,
        JSON.stringify(backup.points)
      );

      await syncLogger.logSyncOperation('backup_restored', projectId, {
        backupTimestamp,
        pointCount: backup.points.length
      });

      return true;
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      await syncLogger.logSyncOperation('backup_restore_error', projectId, {
        error: error instanceof Error ? error.message : 'Unknown error',
        backupTimestamp
      });
      return false;
    }
  }

  static async clearBackups(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.BACKUP_KEY);
    } catch (error) {
      console.error('Failed to clear backups:', error);
    }
  }
}

export const backupService = BackupService; 