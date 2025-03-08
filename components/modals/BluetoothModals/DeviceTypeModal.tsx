import React from 'react';
import { Modal, View, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { DeviceTypeOption, DeviceTypeModalProps } from '@/types/bluetooth.types';
import { BLUETOOTH_DEVICE_TYPES } from '@/utils/constants';
import { Colors } from '@/theme/colors';

export const DeviceTypeModal: React.FC<DeviceTypeModalProps> = ({
  visible,
  onClose,
  onSelectDeviceType,
}) => {
  const renderDeviceType = ({ item }: { item: DeviceTypeOption }) => (
    <TouchableOpacity
      style={styles.deviceTypeItem}
      onPress={() => onSelectDeviceType(item.name)}
    >
      <Text style={styles.deviceTypeText}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Select Device Type</Text>
          <FlatList
            data={BLUETOOTH_DEVICE_TYPES}
            keyExtractor={(item) => item.id}
            renderItem={renderDeviceType}
          />
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
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
    backgroundColor: 'black',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'black',
    borderRadius: 10,
    padding: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: 'white'
  },
  deviceTypeItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  deviceTypeText: {
    fontSize: 16,
    color: 'white'
  },
  closeButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: Colors.Aqua,
    borderRadius: 5,
  },
  closeButtonText: {
    textAlign: 'center',
    color: 'white',
  },
});