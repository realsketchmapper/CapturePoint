import React, { useContext } from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useMapContext } from '@/contexts/MapDisplayContext';
import { useCollectionContext } from '@/contexts/CollectionContext';

export const SyncButton: React.FC = () => {
  const { refreshFeatures } = useMapContext();
  const { syncPoints, syncStatus } = useCollectionContext();
  const { isSyncing } = syncStatus;

  const handleSync = async () => {
    try {
      const success = await syncPoints();
      if (success) {
        await refreshFeatures();
      }
    } catch (error) {
      console.error('Error during sync:', error);
    }
  };

  return (
    <TouchableOpacity 
      style={styles.button} 
      onPress={handleSync}
      disabled={isSyncing}
    >
      {isSyncing ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <MaterialIcons name="sync" size={24} color="#FFFFFF" />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
  },
}); 