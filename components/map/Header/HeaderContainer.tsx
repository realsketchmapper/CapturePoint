import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useBluetooth } from '@/hooks/useBluetooth';
import { useSettings } from '@/hooks/useSettings';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { DeviceTypeModal } from '@/components/modals/BluetoothModals/DeviceTypeModal';
import { DeviceSelectionModal } from '@/components/modals/BluetoothModals/DeviceSelectionModal';
import SettingsMainModal from '@/components/modals/SettingsModal';
import { Colors } from '@/theme/colors';
import { BluetoothButton } from './BluetoothButton';
import { SettingsButton } from './SettingsButton';
import { FeatureButton } from './FeatureButton';
import { BackButton } from './BackButton';
import { ThinHeaderContainer } from '../ThinHeader/ThinHeaderContainer';
import { useFeatureModal } from '@/hooks/useFeatureModal';

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

  const { settings, handleSettingsChange } = useSettingsContext();

  return (
    <View style={styles.headerWrapper}>
      <ThinHeaderContainer />
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <BackButton />
          <View style={styles.buttonContainer}>
            <FeatureButton onPress={handleFeaturePress} />
            <BluetoothButton onPress={handleBluetoothPress} />
            <SettingsButton onPress={handleSettingsPress} />
          </View>
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

      <SettingsMainModal
        visible={isVisible}
        onClose={handleCloseSettings}
        settings={settings}
        handleSettingsChange={handleSettingsChange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  headerWrapper: {
    zIndex: 1000,
  },
  header: {
    backgroundColor: Colors.White,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.LightGrey,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
});