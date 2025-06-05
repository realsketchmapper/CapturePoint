import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/theme/colors';

interface BluetoothDisconnectionModalProps {
  visible: boolean;
  onClose: () => void;
  onReconnect: () => void;
  deviceName: string;
  reason?: string;
}

export const BluetoothDisconnectionModal: React.FC<BluetoothDisconnectionModalProps> = ({
  visible,
  onClose,
  onReconnect,
  deviceName,
  reason
}) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <MaterialIcons 
              name="bluetooth-disabled" 
              size={40} 
              color={Colors.BrightRed} 
            />
            <Text style={styles.title}>Device Disconnected</Text>
          </View>

          <View style={styles.messageContainer}>
            <Text style={styles.deviceName}>{deviceName}</Text>
            <Text style={styles.message}>
              The Bluetooth connection has been lost.
            </Text>
            {reason && (
              <Text style={styles.reason}>
                Reason: {reason}
              </Text>
            )}
            <Text style={styles.instruction}>
              Please check that the device is powered on and within range.
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.reconnectButton]} 
              onPress={onReconnect}
            >
              <MaterialIcons name="refresh" size={20} color="white" />
              <Text style={styles.reconnectButtonText}>Try Reconnect</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.dismissButton]} 
              onPress={onClose}
            >
              <Text style={styles.dismissButtonText}>Dismiss</Text>
            </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: 'RobotoSlab-Bold',
    color: Colors.DarkBlue,
    marginTop: 12,
    textAlign: 'center',
  },
  messageContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  deviceName: {
    fontSize: 16,
    fontFamily: 'RobotoSlab-Bold',
    color: Colors.DarkBlue,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    fontFamily: 'RobotoSlab-Regular',
    color: Colors.Grey,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
  },
  reason: {
    fontSize: 14,
    fontFamily: 'RobotoSlab-Regular',
    color: Colors.BrightRed,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  instruction: {
    fontSize: 14,
    fontFamily: 'RobotoSlab-Regular',
    color: Colors.Grey,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  reconnectButton: {
    backgroundColor: Colors.Aqua,
  },
  dismissButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.VeryLightGrey,
  },
  reconnectButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'RobotoSlab-Medium',
  },
  dismissButtonText: {
    color: Colors.Grey,
    fontSize: 16,
    fontFamily: 'RobotoSlab-Medium',
  },
}); 