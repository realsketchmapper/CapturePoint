import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface SyncLogEntry {
  timestamp: string;
  operation: string;
  projectId: number;
  details: Record<string, any>;
  deviceInfo: {
    platform: string;
    version: string | number;
    batteryLevel?: number;
    isLowPowerMode?: boolean;
  };
}

class SyncLogger {
  private static readonly LOG_KEY = '@sync_logs';
  private static readonly MAX_LOGS = 1000;
  private static readonly LOG_RETENTION_DAYS = 7;

  static async logSyncOperation(
    operation: string,
    projectId: number,
    details: Record<string, any>
  ): Promise<void> {
    const logEntry: SyncLogEntry = {
      timestamp: new Date().toISOString(),
      operation,
      projectId,
      details,
      deviceInfo: {
        platform: Platform.OS,
        version: Platform.Version,
      }
    };

    try {
      const existingLogs = await this.getLogs();
      const newLogs = [logEntry, ...existingLogs].slice(0, this.MAX_LOGS);
      await AsyncStorage.setItem(this.LOG_KEY, JSON.stringify(newLogs));
    } catch (error) {
      console.error('Failed to log sync operation:', error);
    }
  }

  static async getLogs(): Promise<SyncLogEntry[]> {
    try {
      const logsJson = await AsyncStorage.getItem(this.LOG_KEY);
      if (!logsJson) return [];

      const logs: SyncLogEntry[] = JSON.parse(logsJson);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.LOG_RETENTION_DAYS);

      // Filter out old logs
      return logs.filter(log => new Date(log.timestamp) > cutoffDate);
    } catch (error) {
      console.error('Failed to get sync logs:', error);
      return [];
    }
  }

  static async clearLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.LOG_KEY);
    } catch (error) {
      console.error('Failed to clear sync logs:', error);
    }
  }

  static async getLogsForProject(projectId: number): Promise<SyncLogEntry[]> {
    const logs = await this.getLogs();
    return logs.filter(log => log.projectId === projectId);
  }

  static async getRecentErrors(projectId?: number): Promise<SyncLogEntry[]> {
    const logs = await this.getLogs();
    const errorLogs = logs.filter(log => 
      log.operation.includes('error') || 
      (log.details.error && (!projectId || log.projectId === projectId))
    );
    return errorLogs.slice(0, 10); // Return last 10 errors
  }
}

export const syncLogger = SyncLogger; 