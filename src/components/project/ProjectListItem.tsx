import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { ProjectListItemProps } from '@/types/project.types';
import { Colors } from '@/theme/colors';

const getWorkTypeName = (workType: any): string => {
  if (!workType) return 'Not set';
  if (typeof workType === 'string') return workType;
  return workType.name || 'Unknown';
};

export const ProjectListItem: React.FC<ProjectListItemProps> = ({ 
  project, 
  onPress 
}) => (
  <TouchableOpacity
    style={styles.itemContainer}
    onPress={() => onPress(project)}
  >
    <View style={styles.content}>
      <Text style={styles.projectName}>{project.name}</Text>
      <Text style={styles.projectAddress}>{project.client_name}</Text>
      <Text style={styles.projectWorkType}>{getWorkTypeName(project.work_type)}</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  itemContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  content: {
    padding: 16,
  },
  projectName: {
    fontFamily: 'RobotoSlab-Bold',
    fontSize: 18,
    color: 'white',
    marginBottom: 4,
  },
  projectAddress: {
    fontFamily: 'RobotoSlab-Regular',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  projectWorkType: {
    fontFamily: 'RobotoSlab-Regular',
    fontSize: 14,
    color: Colors.LightBlue,
  },
});
