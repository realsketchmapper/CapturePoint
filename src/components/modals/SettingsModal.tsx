import React from 'react';
import { Modal, View, Text, TouchableOpacity, Switch, TextInput, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/src/theme/colors';
import { SettingsProps } from '@/types/settings.types';
import { useBluetooth } from '@/hooks/useBluetooth';
import Slider from '@react-native-community/slider';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  settings: SettingsProps;
  handleSettingsChange: (settings: SettingsProps) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  settings,
  handleSettingsChange,
}) => {
  const { selectedDeviceType } = useBluetooth();
  const showTiltSetting = selectedDeviceType !== 'STONEX';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Collection Settings</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Use Timed Collection</Text>
              <Switch
                value={settings.useTimedCollection}
                onValueChange={(value) =>
                  handleSettingsChange({
                    ...settings,
                    useTimedCollection: value,
                  })
                }
              />
            </View>

            {settings.useTimedCollection && (
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>
                  Collection Duration: {settings.collectionDuration.toFixed(1)}s
                </Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={3}
                  step={1}
                  value={settings.collectionDuration}
                  onValueChange={(value) =>
                    handleSettingsChange({
                      ...settings,
                      collectionDuration: value,
                    })
                  }
                  minimumTrackTintColor={Colors.Aqua}
                  maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
                  thumbTintColor={Colors.Aqua}
                />
              </View>
            )}

            {showTiltSetting && (
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Use Tilt</Text>
                <Switch
                  value={settings.useTilt}
                  onValueChange={(value) =>
                    handleSettingsChange({
                      ...settings,
                      useTilt: value,
                    })
                  }
                />
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Map Settings</Text>
            <Text style={styles.settingLabel}>Basemap Style</Text>
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.option,
                  settings.basemapStyle === 'satellite' && styles.selectedOption,
                ]}
                onPress={() =>
                  handleSettingsChange({
                    ...settings,
                    basemapStyle: 'satellite',
                  })
                }
              >
                <MaterialIcons
                  name="satellite"
                  size={24}
                  color={settings.basemapStyle === 'satellite' ? 'white' : Colors.Grey}
                />
                <Text
                  style={[
                    styles.optionText,
                    settings.basemapStyle === 'satellite' && styles.selectedOptionText,
                  ]}
                >
                  Satellite
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.option,
                  settings.basemapStyle === 'streets' && styles.selectedOption,
                ]}
                onPress={() =>
                  handleSettingsChange({
                    ...settings,
                    basemapStyle: 'streets',
                  })
                }
              >
                <MaterialIcons
                  name="map"
                  size={24}
                  color={settings.basemapStyle === 'streets' ? 'white' : Colors.Grey}
                />
                <Text
                  style={[
                    styles.optionText,
                    settings.basemapStyle === 'streets' && styles.selectedOptionText,
                  ]}
                >
                  Streets
                </Text>
              </TouchableOpacity>
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
    backgroundColor: Colors.DarkBlue,
  },
  modalContent: {
    flex: 1,
    backgroundColor: Colors.DarkBlue,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'white',
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingLabel: {
    fontSize: 16,
    color: 'white',
    flex: 1,
  },
  input: {
    width: 80,
    padding: 8,
    borderWidth: 1,
    borderColor: 'white',
    borderRadius: 8,
    textAlign: 'center',
    color: 'white',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  selectedOption: {
    backgroundColor: Colors.Aqua,
    borderColor: Colors.Aqua,
  },
  optionText: {
    fontSize: 16,
    color: 'white',
  },
  selectedOptionText: {
    color: 'white',
    fontWeight: '500',
  },
  slider: {
    flex: 1,
    marginLeft: 10,
    height: 40,
  },
});

export default SettingsModal; 