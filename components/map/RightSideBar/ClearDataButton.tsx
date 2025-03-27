import React from 'react';
import { TouchableOpacity, StyleSheet, Alert, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { storageService } from '@/services/storage/storageService';

const ClearDataButton: React.FC = () => {
  const handleClearData = async () => {
    Alert.alert(
      'Clear Local Data',
      'Are you sure you want to clear all local data? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await storageService.clearAllData();
              Alert.alert('Success', 'All local data has been cleared.');
              // Reload the app by changing AppState
              AppState.currentState = 'active';
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear local data. Please try again.');
            }
          }
        }
      ]
    );
  };

  return (
    <TouchableOpacity 
      style={styles.button}
      onPress={handleClearData}
    >
      <Ionicons name="trash-outline" size={24} color="#FF3B30" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  }
});

export default ClearDataButton; 