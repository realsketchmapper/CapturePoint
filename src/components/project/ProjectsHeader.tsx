import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ProjectsHeaderProps } from '@/types/project.types';
import { Colors } from '@/theme/colors';
import { featureStorageService } from '@/services/storage/featureStorageService';

export const ProjectsHeader: React.FC<ProjectsHeaderProps> = ({ 
  onRefresh, 
  loading,
  onClearProjectStorage
}) => {
  const [isClearing, setIsClearing] = useState(false);

  const handleClearStorage = () => {
    Alert.alert(
      "Clear Storage",
      "This will clear all locally stored data for debugging purposes. Continue?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => {
            if (onClearProjectStorage) {
              onClearProjectStorage();
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.headerBar}>
      <Text style={styles.headerTitle}>Projects</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClearStorage}
          disabled={isClearing || loading}
        >
          {isClearing ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.clearButtonText}>Clear Storage</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <MaterialIcons name="refresh" size={24} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    fontFamily: 'RobotoSlab-Bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 4,
  },
  clearButton: {
    backgroundColor: Colors.BrightRed,
    padding: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  }
});