import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Colors } from '@/theme/colors';

interface ProjectDistanceWarningModalProps {
  isVisible: boolean;
  onCancel: () => void;
  onContinue: () => void;
  distance: number;
  projectName: string;
  projectAddress: string;
}

export const ProjectDistanceWarningModal: React.FC<ProjectDistanceWarningModalProps> = ({
  isVisible,
  onCancel,
  onContinue,
  distance,
  projectName,
  projectAddress
}) => {
  const distanceMiles = (distance / 1609.34).toFixed(1);

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Location Warning</Text>
          
          <View style={styles.detailsContainer}>
            <Text style={styles.projectName}>
              <Text style={styles.label}>WO: </Text>
              {projectName}
            </Text>
            <Text style={styles.projectAddress}>
              <Text style={styles.label}>Address: </Text>
              {projectAddress}
            </Text>
            <Text style={styles.warningText}>
              This project is approximately {distanceMiles} miles from your current location.
            </Text>
            <Text style={styles.warningSubtext}>
              Are you sure you want to open this project?
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Return to List</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.continueButton]} 
              onPress={onContinue}
            >
              <Text style={styles.continueButtonText}>Continue Anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.DarkBlue,
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  title: {
    fontSize: 20,
    fontFamily: 'RobotoSlab-Bold',
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  detailsContainer: {
    gap: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  projectName: {
    fontSize: 18,
    fontFamily: 'RobotoSlab-Bold',
    color: 'white',
    textAlign: 'center',
  },
  projectAddress: {
    fontSize: 16,
    fontFamily: 'RobotoSlab-Regular',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 16,
    fontFamily: 'RobotoSlab-Regular',
    color: 'white',
    textAlign: 'center',
  },
  warningSubtext: {
    fontSize: 14,
    fontFamily: 'RobotoSlab-Regular',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  continueButton: {
    backgroundColor: Colors.BrightRed,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'RobotoSlab-Regular',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'RobotoSlab-Regular',
  },
  label: {
    fontFamily: 'RobotoSlab-Bold',
    color: 'rgba(255, 255, 255, 0.7)',
  },
}); 