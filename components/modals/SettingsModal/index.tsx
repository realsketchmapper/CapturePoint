import React from 'react';
import { Modal, View, Text, Switch, StyleSheet, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { useBluetooth } from '@/hooks/useBluetooth';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { SettingsModalProps } from '@/types/settings.types';

const SettingsMainModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const { settings, handleSettingsChange } = useSettingsContext();
  const { selectedDeviceType } = useBluetooth();
  const showTiltSetting = selectedDeviceType !== 'STONEX';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Collection Settings</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Timed Collection</Text>
            <Switch
              value={settings.useTimedCollection}
              onValueChange={(value: boolean) =>
                handleSettingsChange({
                  ...settings,
                  useTimedCollection: value
                })
              }
            />
          </View>

          {settings.useTimedCollection && (
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>
                Duration: {settings.collectionDuration.toFixed(1)}s
              </Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={3}
                step={1}
                value={settings.collectionDuration}
                onValueChange={(value: number) =>
                  handleSettingsChange({
                    ...settings,
                    collectionDuration: value
                  })
                }
              />
            </View>
          )}

          {showTiltSetting && (
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Use Tilt</Text>
              <Switch
                value={settings.useTilt}
                onValueChange={(value: boolean) =>
                  handleSettingsChange({
                    ...settings,
                    useTilt: value
                  })
                }
              />
            </View>
          )}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Close</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 16,
    flex: 1,
  },
  slider: {
    flex: 1,
    marginLeft: 10,
  },
  closeButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SettingsMainModal;