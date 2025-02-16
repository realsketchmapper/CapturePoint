import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { ProjectListItemProps } from '@/types/project.types';
import { Colors } from '@/theme/colors';

export const ProjectListItem: React.FC<ProjectListItemProps> = ({ 
  project, 
  onPress 
}) => (
  <TouchableOpacity
    style={styles.itemContainer}
    onPress={() => onPress(project)}
  >
    <Text style={styles.projectName}>{project.name}</Text>
    <Text style={styles.projectAddress}>{project.client_name}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  itemContainer: {
    backgroundColor: Colors.Aqua,
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  projectName: {
    fontFamily: 'RobotoSlab-Bold',
    fontSize: 17,
    color: 'white',
    marginBottom: 4,
  },
  projectAddress: {
    fontFamily: 'RobotoSlab-Regular',
    fontSize: 15,
    color: 'white',
  },
});
