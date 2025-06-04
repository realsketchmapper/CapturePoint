import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  Share,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet
} from 'react-native';
import { bluetoothDataLogger, LogSession, BluetoothLogEntry } from '@/services/logging/bluetoothDataLogger';
import { Colors } from '@/theme/colors';

interface BluetoothDataLogModalProps {
  visible: boolean;
  onClose: () => void;
}

type ViewMode = 'sessions' | 'logs' | 'buttonEvents';

export const BluetoothDataLogModal: React.FC<BluetoothDataLogModalProps> = ({
  visible,
  onClose
}) => {
  const [sessions, setSessions] = useState<LogSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<LogSession | null>(null);
  const [logs, setLogs] = useState<BluetoothLogEntry[]>([]);
  const [buttonEvents, setButtonEvents] = useState<BluetoothLogEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('sessions');
  const [loading, setLoading] = useState(false);
  const [currentLoggingStatus, setCurrentLoggingStatus] = useState<{
    isLogging: boolean;
    currentSession: LogSession | null;
  }>({ isLogging: false, currentSession: null });

  useEffect(() => {
    if (visible) {
      loadSessions();
      updateLoggingStatus();
    }
  }, [visible]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const sessionList = await bluetoothDataLogger.getSessions();
      setSessions(sessionList);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
    setLoading(false);
  };

  const updateLoggingStatus = () => {
    const status = bluetoothDataLogger.getLoggingStatus();
    setCurrentLoggingStatus(status);
  };

  const loadLogsForSession = async (session: LogSession) => {
    setLoading(true);
    try {
      const sessionLogs = await bluetoothDataLogger.getLogsForSession(session.sessionId);
      const sessionButtonEvents = await bluetoothDataLogger.getPotentialButtonEvents(session.sessionId);
      
      setLogs(sessionLogs);
      setButtonEvents(sessionButtonEvents);
      setSelectedSession(session);
      setViewMode('logs');
    } catch (error) {
      console.error('Error loading logs for session:', error);
    }
    setLoading(false);
  };

  const handleExportLogs = async (sessionId?: string) => {
    try {
      setLoading(true);
      const filePath = await bluetoothDataLogger.exportLogsToFile(sessionId);
      
      Alert.alert(
        'Export Complete',
        `Logs exported to: ${filePath}`,
        [
          {
            text: 'Share',
            onPress: () => {
              Share.share({
                url: filePath,
                title: 'Bluetooth Data Logs'
              });
            }
          },
          { text: 'OK' }
        ]
      );
    } catch (error) {
      console.error('Error exporting logs:', error);
      Alert.alert('Export Error', 'Failed to export logs');
    }
    setLoading(false);
  };

  const handleClearLogs = () => {
    Alert.alert(
      'Clear All Logs',
      'Are you sure you want to clear all Bluetooth data logs? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await bluetoothDataLogger.clearAllLogs();
              setSessions([]);
              setLogs([]);
              setButtonEvents([]);
              setSelectedSession(null);
              setViewMode('sessions');
              Alert.alert('Success', 'All logs cleared');
            } catch (error) {
              console.error('Error clearing logs:', error);
              Alert.alert('Error', 'Failed to clear logs');
            }
          }
        }
      ]
    );
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (session: LogSession) => {
    if (!session.endTime) return 'In Progress';
    const start = new Date(session.startTime);
    const end = new Date(session.endTime);
    const duration = end.getTime() - start.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderSession = ({ item }: { item: LogSession }) => (
    <TouchableOpacity
      style={styles.sessionItem}
      onPress={() => loadLogsForSession(item)}
    >
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionTitle}>{item.deviceName}</Text>
        <Text style={styles.sessionType}>{item.deviceType}</Text>
      </View>
      <Text style={styles.sessionTime}>
        Started: {formatTimestamp(item.startTime)}
      </Text>
      <View style={styles.sessionStats}>
        <Text style={styles.statText}>Entries: {item.entryCount}</Text>
        <Text style={styles.statText}>Duration: {formatDuration(item)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderLogEntry = ({ item }: { item: BluetoothLogEntry }) => (
    <View style={[
      styles.logEntry,
      item.isButtonEvent && styles.buttonEventEntry
    ]}>
      <View style={styles.logHeader}>
        <Text style={styles.logTimestamp}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
        <View style={styles.logTypeContainer}>
          <Text style={[styles.logType, styles[`${item.dataType}Type`]]}>
            {item.dataType.toUpperCase()}
          </Text>
          {item.isButtonEvent && (
            <Text style={styles.buttonEventLabel}>BUTTON?</Text>
          )}
        </View>
      </View>
      <Text style={styles.logData} numberOfLines={3}>
        {item.data}
      </Text>
      <Text style={styles.logLength}>Length: {item.dataLength} chars</Text>
    </View>
  );

  const renderTopBar = () => (
    <View style={styles.topBar}>
      <View style={styles.topBarLeft}>
        {viewMode !== 'sessions' && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (viewMode === 'buttonEvents') {
                setViewMode('logs');
              } else {
                setViewMode('sessions');
                setSelectedSession(null);
              }
            }}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <Text style={styles.modalTitle}>
        {viewMode === 'sessions' && 'Bluetooth Data Logs'}
        {viewMode === 'logs' && `${selectedSession?.deviceName} - Logs`}
        {viewMode === 'buttonEvents' && `${selectedSession?.deviceName} - Button Events`}
      </Text>
      
      <View style={styles.topBarRight}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderActionButtons = () => (
    <View style={styles.actionButtons}>
      {viewMode === 'sessions' && (
        <>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleExportLogs()}
          >
            <Text style={styles.actionButtonText}>Export All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={handleClearLogs}
          >
            <Text style={styles.actionButtonText}>Clear All</Text>
          </TouchableOpacity>
        </>
      )}
      
      {viewMode === 'logs' && selectedSession && (
        <>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setViewMode('buttonEvents')}
          >
            <Text style={styles.actionButtonText}>
              Button Events ({buttonEvents.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleExportLogs(selectedSession.sessionId)}
          >
            <Text style={styles.actionButtonText}>Export Session</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderCurrentStatus = () => {
    if (!currentLoggingStatus.isLogging) return null;
    
    return (
      <View style={styles.statusBanner}>
        <Text style={styles.statusText}>
          🔴 Currently logging: {currentLoggingStatus.currentSession?.deviceName}
        </Text>
        <Text style={styles.statusSubtext}>
          Entries: {currentLoggingStatus.currentSession?.entryCount || 0}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {renderTopBar()}
        {renderCurrentStatus()}
        
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.Aqua} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        {!loading && (
          <>
            {viewMode === 'sessions' && (
              <FlatList
                data={sessions}
                keyExtractor={(item) => item.sessionId}
                renderItem={renderSession}
                style={styles.list}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      No logging sessions found.
                      {'\n\n'}
                      Connect to an RTK-Pro device to start logging.
                    </Text>
                  </View>
                }
              />
            )}

            {(viewMode === 'logs' || viewMode === 'buttonEvents') && (
              <FlatList
                data={viewMode === 'logs' ? logs : buttonEvents}
                keyExtractor={(item, index) => `${item.timestamp}_${index}`}
                renderItem={renderLogEntry}
                style={styles.list}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      {viewMode === 'logs' ? 'No log entries found' : 'No button events detected'}
                    </Text>
                  </View>
                }
              />
            )}
          </>
        )}

        {renderActionButtons()}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.OffWhite,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.VeryLightGrey,
    backgroundColor: 'white',
  },
  topBarLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  topBarRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.DarkBlue,
    flex: 2,
    textAlign: 'center',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: Colors.Aqua,
    fontSize: 16,
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  closeButtonText: {
    color: Colors.Aqua,
    fontSize: 16,
  },
  statusBanner: {
    backgroundColor: Colors.BrightRed,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statusSubtext: {
    color: 'white',
    fontSize: 12,
    opacity: 0.9,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.DarkBlue,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sessionItem: {
    backgroundColor: 'white',
    padding: 16,
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.VeryLightGrey,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.DarkBlue,
    flex: 1,
  },
  sessionType: {
    fontSize: 12,
    color: Colors.Aqua,
    backgroundColor: Colors.LightBlue,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sessionTime: {
    fontSize: 12,
    color: Colors.Grey,
    marginBottom: 8,
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statText: {
    fontSize: 12,
    color: Colors.Grey,
  },
  logEntry: {
    backgroundColor: 'white',
    padding: 12,
    marginVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.VeryLightGrey,
  },
  buttonEventEntry: {
    borderColor: Colors.Yellow,
    backgroundColor: '#FFF8E1', // Light yellow background
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logTimestamp: {
    fontSize: 12,
    color: Colors.Grey,
  },
  logTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logType: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 4,
  },
  rawType: {
    backgroundColor: Colors.VeryLightGrey,
    color: Colors.DarkBlue,
  },
  nmeaType: {
    backgroundColor: Colors.Aqua,
    color: 'white',
  },
  eventType: {
    backgroundColor: Colors.BrightGreen,
    color: 'white',
  },
  buttonEventLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: Colors.Yellow,
    color: Colors.DarkBlue,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  logData: {
    fontSize: 11,
    color: Colors.DarkBlue,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  logLength: {
    fontSize: 10,
    color: Colors.Grey,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.VeryLightGrey,
    backgroundColor: 'white',
  },
  actionButton: {
    backgroundColor: Colors.Aqua,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: Colors.BrightRed,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.Grey,
    textAlign: 'center',
    lineHeight: 24,
  },
}); 