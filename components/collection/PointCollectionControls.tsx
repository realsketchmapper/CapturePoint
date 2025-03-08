// components/PointCollectionControls.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { useCollectionContext } from '@/contexts/CollectionContext';

const PointCollectionControls: React.FC = () => {
  const { 
    isCollecting, 
    currentPoints, 
    stopCollection,
    isSaving,
    saveCurrentPoint,
    syncStatus,
    syncPoints
  } = useCollectionContext();
  
  const { isSyncing, unsyncedCount, lastSyncTime } = syncStatus;
  
  const [pointName, setPointName] = useState('');
  const [description, setDescription] = useState('');
  
  // Save current collection
  const handleSave = async () => {
    if (!isCollecting) {
      Alert.alert('Error', 'No active collection');
      return;
    }
    
    const properties = {
      name: pointName || `Point ${new Date().toLocaleTimeString()}`,
      description: description || ''
    };
    
    const success = await saveCurrentPoint(properties);
    
    if (success) {
      Alert.alert('Success', 'Point saved successfully');
      setPointName('');
      setDescription('');
    } else {
      Alert.alert('Error', 'Failed to save point');
    }
  };
  
  // Sync points with server
  const handleSync = async () => {
    if (unsyncedCount === 0) {
      Alert.alert('Info', 'No points to sync');
      return;
    }
    
    const success = await syncPoints();
    
    if (success) {
      Alert.alert('Success', `Points synced successfully`);
    } else {
      Alert.alert('Error', 'Failed to sync points');
    }
  };
  
  if (!isCollecting) {
    // Only show sync controls when not collecting
    return (
      <View style={styles.container}>
        <View style={styles.syncContainer}>
          <Text style={styles.syncText}>
            {unsyncedCount} points waiting to sync
            {lastSyncTime && ` (Last sync: ${lastSyncTime.toLocaleTimeString()})`}
          </Text>
          
          <TouchableOpacity
            style={[styles.button, styles.syncButton]}
            onPress={handleSync}
            disabled={isSyncing || unsyncedCount === 0}
          >
            <Text style={styles.buttonText}>
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  // Show collection controls when actively collecting
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Collecting Point {currentPoints.length > 0 && `(${currentPoints.length} points)`}
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="Point Name"
        value={pointName}
        onChangeText={setPointName}
      />
      
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.buttonText}>
            {isSaving ? 'Saving...' : 'Save Point'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={stopCollection}
          disabled={isSaving}
        >
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    margin: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  saveButton: {
    backgroundColor: '#007BFF',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  syncButton: {
    backgroundColor: '#28a745',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  syncContainer: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#f8f9fa',
  },
  syncText: {
    marginBottom: 8,
  },
});

export default PointCollectionControls;