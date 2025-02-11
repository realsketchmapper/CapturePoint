import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useBluetooth } from '@/hooks/useBluetooth';
import { DeviceTypeModal } from '@/components/modals/BluetoothModals/DeviceTypeModal';
import { DeviceSelectionModal } from '@/components/modals/BluetoothModals/DeviceSelectionModal';
import { Colors } from '@/theme/colors';
import { BluetoothButton } from './BluetoothButton';

export const HeaderContainer: React.FC = () => {
  const {
    isDeviceTypeModalVisible,
    isDeviceSelectionModalVisible,
    selectedDeviceType,
    handleBluetoothPress,
    handleDeviceTypeSelection,
    handleDeviceSelection,
    handleCloseDeviceTypeModal,
    handleCloseDeviceSelectionModal
  } = useBluetooth();

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <BluetoothButton onPress={handleBluetoothPress} />
      </View>

      <DeviceTypeModal
        visible={isDeviceTypeModalVisible}
        onClose={handleCloseDeviceTypeModal}
        onSelectDeviceType={handleDeviceTypeSelection}
      />

      {selectedDeviceType && (
        <DeviceSelectionModal
          isVisible={isDeviceSelectionModalVisible}
          onClose={handleCloseDeviceSelectionModal}
          onDeviceSelected={handleDeviceSelection}
          deviceType={selectedDeviceType}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    width: '100%',
    backgroundColor: Colors.DarkBlue,
    padding: 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  headerButton: {
    padding: 8,
  },
});