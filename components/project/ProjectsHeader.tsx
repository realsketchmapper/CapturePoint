import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ProjectsHeaderProps } from '@/types/project.types';
import { Colors } from '@/theme/colors';

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
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <MaterialIcons name="refresh" size={24} color="#fff" />
      )}
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  headerBar: {
    backgroundColor: Colors.DarkBlue,
    width: '100%',
    padding: 4,
    paddingTop: 5, // Adjust this value based on your status bar
    elevation: 5, // for Android shadow
    shadowColor: '#000', // for iOS shadow
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  headerTitle: {
    fontFamily: 'RobotoSlab-Bold',
    fontSize: 24,
    color: 'white',
    textAlign: 'center',
  },
  refreshButton: {
    position: 'absolute',          // Add this
    right: 15,                     // Add this
    top: 10,                       // Match this with paddingTop
  }
});