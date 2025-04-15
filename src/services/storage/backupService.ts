import AsyncStorage from '@react-native-async-storage/async-storage';
import { PointCollected } from '@/types/pointCollected.types';
import { ProjectId, toProjectIdString } from '@/utils/projectId';

interface BackupData {
  timestamp: string;
  points: PointCollected[];
}

class BackupService {
  private readonly BACKUP_PREFIX = '@backup_';
  private readonly MAX_BACKUPS = 5; // Keep last 5 backups

  /**
   * Gets the storage key for a project backup
   */
  private getBackupKey(projectId: string, timestamp: string): string {
    return `${this.BACKUP_PREFIX}${projectId}_${timestamp}`;
  }

  /**
   * Creates a backup of project points
   */
  async createBackup(points: PointCollected[], projectId: ProjectId): Promise<void> {
    const projectIdStr = toProjectIdString(projectId);
    const timestamp = new Date().toISOString();
    const backupKey = this.getBackupKey(projectIdStr, timestamp);

    const backupData: BackupData = {
      timestamp,
      points
    };

    await AsyncStorage.setItem(backupKey, JSON.stringify(backupData));
    await this.cleanupOldBackups(projectIdStr);
  }

  /**
   * Gets all backups for a project
   */
  async getBackupsForProject(projectId: ProjectId): Promise<BackupData[]> {
    const projectIdStr = toProjectIdString(projectId);
    const allKeys = await AsyncStorage.getAllKeys();
    const backupKeys = allKeys.filter(key => 
      key.startsWith(`${this.BACKUP_PREFIX}${projectIdStr}_`)
    );

    const backups: BackupData[] = [];
    for (const key of backupKeys) {
      const backupJson = await AsyncStorage.getItem(key);
      if (backupJson) {
        backups.push(JSON.parse(backupJson));
      }
    }

    // Sort by timestamp, newest first
    return backups.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Restores a project from a specific backup
   */
  async restoreFromBackup(timestamp: string, projectId: ProjectId): Promise<BackupData> {
    const projectIdStr = toProjectIdString(projectId);
    const backupKey = this.getBackupKey(projectIdStr, timestamp);
    const backupJson = await AsyncStorage.getItem(backupKey);

    if (!backupJson) {
      throw new Error(`Backup not found for timestamp ${timestamp}`);
    }

    const backupData: BackupData = JSON.parse(backupJson);
    return backupData;
  }

  /**
   * Cleans up old backups, keeping only the most recent ones
   */
  private async cleanupOldBackups(projectId: string): Promise<void> {
    const backups = await this.getBackupsForProject(projectId);
    if (backups.length <= this.MAX_BACKUPS) return;

    // Delete oldest backups
    const backupsToDelete = backups.slice(this.MAX_BACKUPS);
    for (const backup of backupsToDelete) {
      const backupKey = this.getBackupKey(projectId, backup.timestamp);
      await AsyncStorage.removeItem(backupKey);
    }
  }

  /**
   * Deletes all backups for a project
   */
  async deleteProjectBackups(projectId: ProjectId): Promise<void> {
    const projectIdStr = toProjectIdString(projectId);
    const allKeys = await AsyncStorage.getAllKeys();
    const backupKeys = allKeys.filter(key => 
      key.startsWith(`${this.BACKUP_PREFIX}${projectIdStr}_`)
    );

    for (const key of backupKeys) {
      await AsyncStorage.removeItem(key);
    }
  }
}

export const backupService = new BackupService(); 