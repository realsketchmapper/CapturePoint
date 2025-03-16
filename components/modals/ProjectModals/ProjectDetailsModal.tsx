import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';
import { Project } from '@/types/project.types';

interface ProjectDetailsModalProps {
  isVisible: boolean;
  onClose: () => void;
  project: Project | null;
}

export const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({
  isVisible,
  onClose,
  project
}) => {
  if (!project) return null;

  // Ensure all values are strings and handle special cases
  const safeString = (value: any): string => {
    if (value === null || value === undefined) return 'Not set';
    if (typeof value === 'string') return value;
    // Handle work_type object
    if (typeof value === 'object' && value.name) return value.name;
    return String(value);
  };

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Project Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Work Order:</Text>
              <Text style={styles.value}>{safeString(project.name)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.label}>Client:</Text>
              <Text style={styles.value}>{safeString(project.client_name)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.label}>Address:</Text>
              <Text style={styles.value}>{safeString(project.address)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.label}>Work Type:</Text>
              <Text style={styles.value}>{safeString(project.work_type)}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxWidth: 500,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.VeryLightGrey,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.DarkBlue,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: Colors.DarkBlue,
    fontSize: 16,
  },
  detailsContainer: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.Grey,
  },
  value: {
    flex: 2,
    fontSize: 16,
    color: Colors.DarkBlue,
  },
}); 