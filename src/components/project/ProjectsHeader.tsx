import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ProjectsHeaderProps } from '@/types/project.types';
import { Colors } from '@/src/theme/colors';

export const ProjectsHeader: React.FC<ProjectsHeaderProps> = ({ 
  onRefresh, 
  loading 
}) => (
  <View style={styles.headerBar}>
    <Text style={styles.headerTitle}>Projects</Text>
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
);

const styles = StyleSheet.create({
  headerBar: {
    backgroundColor: Colors.DarkBlue,
    width: '100%',
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontFamily: 'RobotoSlab-Bold',
    fontSize: 24,
    color: 'white',
    textAlign: 'center',
  },
  refreshButton: {
    position: 'absolute',
    right: 16,
    top: 20,
    padding: 8,
  },
});