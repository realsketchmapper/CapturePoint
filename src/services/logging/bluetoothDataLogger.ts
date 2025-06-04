import AsyncStorage from '@react-native-async-storage/async-storage';
import { BluetoothDeviceType } from '@/types/bluetooth.types';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface BluetoothLogEntry {
  timestamp: string;
  deviceType: BluetoothDeviceType;
  deviceName: string;
  deviceAddress: string;
  dataType: 'raw' | 'nmea' | 'event';
  data: string;
  dataLength: number;
  isButtonEvent?: boolean; // Flag to mark potential button events
}

export interface LogSession {
  sessionId: string;
  deviceType: BluetoothDeviceType;
  deviceName: string;
  deviceAddress: string;
  startTime: string;
  endTime?: string;
  entryCount: number;
  filePath?: string;
}

class BluetoothDataLogger {
  private static readonly LOG_STORAGE_KEY = '@bluetooth_logs';
  private static readonly SESSIONS_KEY = '@bluetooth_log_sessions';
  private static readonly MAX_MEMORY_ENTRIES = 500; // Keep last 500 entries in memory
  private static readonly LOG_RETENTION_DAYS = 7;
  
  private currentSession: LogSession | null = null;
  private isLogging = false;
  private logBuffer: BluetoothLogEntry[] = [];
  private bufferFlushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_FLUSH_INTERVAL = 5000; // Flush every 5 seconds

  /**
   * Start logging for a specific device
   */
  async startLogging(
    deviceType: BluetoothDeviceType,
    deviceName: string,
    deviceAddress: string
  ): Promise<string> {
    if (this.isLogging) {
      await this.stopLogging();
    }

    const sessionId = `${deviceType}_${Date.now()}`;
    const startTime = new Date().toISOString();

    this.currentSession = {
      sessionId,
      deviceType,
      deviceName,
      deviceAddress,
      startTime,
      entryCount: 0
    };

    this.isLogging = true;
    this.logBuffer = [];

    // Start buffer flush interval
    this.bufferFlushInterval = setInterval(() => {
      this.flushBuffer();
    }, this.BUFFER_FLUSH_INTERVAL);

    await this.saveSession(this.currentSession);

    console.log('🔵 ========================================');
    console.log(`🔵 RTK-PRO BLUETOOTH LOGGING STARTED`);
    console.log(`🔵 Session: ${sessionId}`);
    console.log(`🔵 Device: ${deviceName} (${deviceAddress})`);
    console.log(`🔵 Time: ${new Date().toLocaleString()}`);
    console.log('🔵 ========================================');
    console.log('🔵 Press the RTK-Pro button now to capture data!');
    console.log('🔵 ========================================');

    return sessionId;
  }

  /**
   * Stop current logging session
   */
  async stopLogging(): Promise<void> {
    if (!this.isLogging || !this.currentSession) {
      return;
    }

    // Clear flush interval
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
      this.bufferFlushInterval = null;
    }

    // Flush any remaining data
    await this.flushBuffer();

    // Update session end time
    this.currentSession.endTime = new Date().toISOString();
    await this.saveSession(this.currentSession);

    console.log('🔴 ========================================');
    console.log(`🔴 RTK-PRO BLUETOOTH LOGGING STOPPED`);
    console.log(`🔴 Session: ${this.currentSession.sessionId}`);
    console.log(`🔴 Total entries captured: ${this.currentSession.entryCount}`);
    console.log(`🔴 Duration: ${this.formatDuration()}`);
    console.log('🔴 ========================================');

    this.isLogging = false;
    this.currentSession = null;
    this.logBuffer = [];
  }

  /**
   * Log raw data from Bluetooth device
   */
  async logData(data: string, dataType: 'raw' | 'nmea' | 'event' = 'raw'): Promise<void> {
    if (!this.isLogging || !this.currentSession) {
      return;
    }

    const entry: BluetoothLogEntry = {
      timestamp: new Date().toISOString(),
      deviceType: this.currentSession.deviceType,
      deviceName: this.currentSession.deviceName,
      deviceAddress: this.currentSession.deviceAddress,
      dataType,
      data: data.trim(),
      dataLength: data.length,
      isButtonEvent: this.detectPotentialButtonEvent(data, dataType)
    };

    this.logBuffer.push(entry);
    this.currentSession.entryCount++;

    // Console logging with formatting
    this.logToConsole(entry);

    // If buffer is getting large, flush immediately
    if (this.logBuffer.length >= 100) {
      await this.flushBuffer();
    }
  }

  /**
   * Log entry to console with nice formatting
   */
  private logToConsole(entry: BluetoothLogEntry): void {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    
    // Only log button events to console - suppress continuous data streams
    if (entry.isButtonEvent) {
      console.log('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨');
      console.log('🚨 BUTTON EVENT LOGGED TO STORAGE! 🚨');
      console.log(`🚨 Time: ${time}`);
      console.log(`🚨 Type: ${entry.dataType.toUpperCase()}`);
      console.log(`🚨 Data: ${entry.data}`);
      console.log(`🚨 Length: ${entry.dataLength} chars`);
      console.log('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨');
    }
    // Continuous NMEA and scanning data is still logged to storage but not to console
  }

  /**
   * Get icon for data type
   */
  private getDataTypeIcon(dataType: string): string {
    switch (dataType) {
      case 'nmea': return '📡';
      case 'event': return '⚡';
      case 'raw': return '📄';
      default: return '📝';
    }
  }

  /**
   * Format duration for logging
   */
  private formatDuration(): string {
    if (!this.currentSession?.endTime) return 'Unknown';
    const start = new Date(this.currentSession.startTime);
    const end = new Date(this.currentSession.endTime);
    const duration = end.getTime() - start.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Detect potential button press events in the data
   */
  private detectPotentialButtonEvent(data: string, dataType: string): boolean {
    // For RTK-Pro devices, look for potential button event patterns
    // This is a heuristic approach - we'll refine it based on observed data
    if (dataType === 'event') {
      return true;
    }

    // Look for unusual NMEA sentences or data patterns that might indicate button presses
    const upperData = data.toUpperCase();
    
    // Common patterns that might indicate events (to be refined)
    const eventPatterns = [
      'EVENT',
      'BUTTON',
      'MARK',
      'POINT',
      'COLLECT',
      'TRIGGER',
      '$PGRME', // Some devices send this on button press
      '$PGRMF', // Another potential event sentence
      'PGRMT',  // Trimble specific event messages
      'VLOC',   // vLoc specific messages
      'RTK',    // RTK specific messages
    ];

    return eventPatterns.some(pattern => upperData.includes(pattern));
  }

  /**
   * Flush buffer to storage
   */
  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    try {
      // Get existing logs
      const existingLogs = await this.getStoredLogs();
      
      // Add new entries to the beginning (most recent first)
      const updatedLogs = [...this.logBuffer, ...existingLogs].slice(0, BluetoothDataLogger.MAX_MEMORY_ENTRIES);
      
      // Save to storage
      await AsyncStorage.setItem(BluetoothDataLogger.LOG_STORAGE_KEY, JSON.stringify(updatedLogs));
      
      console.log(`💾 Flushed ${this.logBuffer.length} log entries to storage`);
      this.logBuffer = [];
    } catch (error) {
      console.error('❌ Error flushing log buffer:', error);
    }
  }

  /**
   * Get stored log entries
   */
  private async getStoredLogs(): Promise<BluetoothLogEntry[]> {
    try {
      const logsJson = await AsyncStorage.getItem(BluetoothDataLogger.LOG_STORAGE_KEY);
      if (!logsJson) return [];

      const logs: BluetoothLogEntry[] = JSON.parse(logsJson);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - BluetoothDataLogger.LOG_RETENTION_DAYS);

      // Filter out old logs
      return logs.filter(log => new Date(log.timestamp) > cutoffDate);
    } catch (error) {
      console.error('Failed to get stored logs:', error);
      return [];
    }
  }

  /**
   * Save session information
   */
  private async saveSession(session: LogSession): Promise<void> {
    try {
      const sessions = await this.getSessions();
      const updatedSessions = [session, ...sessions.filter(s => s.sessionId !== session.sessionId)];
      await AsyncStorage.setItem(BluetoothDataLogger.SESSIONS_KEY, JSON.stringify(updatedSessions));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  /**
   * Get all logging sessions
   */
  async getSessions(): Promise<LogSession[]> {
    try {
      const sessionsJson = await AsyncStorage.getItem(BluetoothDataLogger.SESSIONS_KEY);
      if (!sessionsJson) return [];

      const sessions: LogSession[] = JSON.parse(sessionsJson);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - BluetoothDataLogger.LOG_RETENTION_DAYS);

      return sessions.filter(session => new Date(session.startTime) > cutoffDate);
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return [];
    }
  }

  /**
   * Get logs for a specific session
   */
  async getLogsForSession(sessionId: string): Promise<BluetoothLogEntry[]> {
    const allLogs = await this.getStoredLogs();
    const sessionStartTime = await this.getSessionStartTime(sessionId);
    const sessionEndTime = await this.getSessionEndTime(sessionId);
    
    return allLogs.filter(log => 
      log.timestamp >= sessionStartTime &&
      (!sessionEndTime || log.timestamp <= sessionEndTime)
    );
  }

  /**
   * Get potential button events from logs
   */
  async getPotentialButtonEvents(sessionId?: string): Promise<BluetoothLogEntry[]> {
    const logs = sessionId ? await this.getLogsForSession(sessionId) : await this.getStoredLogs();
    return logs.filter(log => log.isButtonEvent);
  }

  /**
   * Export logs to a shareable format
   */
  async exportLogsToFile(sessionId?: string): Promise<string> {
    try {
      const logs = sessionId ? await this.getLogsForSession(sessionId) : await this.getStoredLogs();
      const sessions = await this.getSessions();
      const session = sessionId ? sessions.find(s => s.sessionId === sessionId) : null;

      const exportData = {
        exportTime: new Date().toISOString(),
        session: session,
        totalEntries: logs.length,
        buttonEvents: logs.filter(log => log.isButtonEvent).length,
        logs: logs
      };

      const filename = `bluetooth_logs_${sessionId || 'all'}_${Date.now()}.json`;
      const documentsDir = FileSystem.documentDirectory;
      const filepath = `${documentsDir}${filename}`;

      await FileSystem.writeAsStringAsync(filepath, JSON.stringify(exportData, null, 2));

      console.log(`Exported ${logs.length} log entries to ${filepath}`);
      return filepath;
    } catch (error) {
      console.error('Error exporting logs:', error);
      throw error;
    }
  }

  /**
   * Clear all logs and sessions
   */
  async clearAllLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem(BluetoothDataLogger.LOG_STORAGE_KEY);
      await AsyncStorage.removeItem(BluetoothDataLogger.SESSIONS_KEY);
      console.log('Cleared all Bluetooth logs and sessions');
    } catch (error) {
      console.error('Error clearing logs:', error);
    }
  }

  /**
   * Get current logging status
   */
  getLoggingStatus(): { isLogging: boolean; currentSession: LogSession | null } {
    return {
      isLogging: this.isLogging,
      currentSession: this.currentSession
    };
  }

  private async getSessionStartTime(sessionId: string): Promise<string> {
    const sessions = await this.getSessions();
    const session = sessions.find(s => s.sessionId === sessionId);
    return session?.startTime || '';
  }

  private async getSessionEndTime(sessionId: string): Promise<string | null> {
    const sessions = await this.getSessions();
    const session = sessions.find(s => s.sessionId === sessionId);
    return session?.endTime || null;
  }
}

export const bluetoothDataLogger = new BluetoothDataLogger(); 