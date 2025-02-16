import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useBluetooth } from '@/hooks/useBluetooth';
import { useSettings } from '@/hooks/useSettings';
import { DeviceTypeModal } from '@/components/modals/BluetoothModals/DeviceTypeModal';
import { DeviceSelectionModal } from '@/components/modals/BluetoothModals/DeviceSelectionModal';
import SettingsMainModal from '@/components/modals/SettingsModal';
import { Colors } from '@/theme/colors';
import { BluetoothButton } from './BluetoothButton';
import { SettingsButton } from './SettingsButton';
import { ProjectNameDisplay } from './ProjectNameDisplay';
import { FeatureButton } from './FeatureButton';
import { useFeatureModal } from '@/hooks/useFeatureModal';
import { FeatureListModal } from '@/components/modals/FeatureModals/FeatureListModal';

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

  const {
    isVisible,
    handleSettingsPress,
    handleCloseSettings,
  } = useSettings();

  const {
    isFeatureModalVisible,
    handleFeaturePress,
    handleCloseFeatureModal,
  } = useFeatureModal();

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <ProjectNameDisplay />
        <View style={styles.buttonContainer}>
        <FeatureButton onPress={handleFeaturePress} />
          <BluetoothButton onPress={handleBluetoothPress} />
          <SettingsButton onPress={handleSettingsPress} />
        </View>
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

      <FeatureListModal
        isVisible={isFeatureModalVisible}
        onClose={handleCloseFeatureModal}
      />


      <SettingsMainModal
        visible={isVisible}
        onClose={handleCloseSettings}
      />
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
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  }
});