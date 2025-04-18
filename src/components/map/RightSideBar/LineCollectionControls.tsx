import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/theme/colors';

interface LineCollectionControlsProps {
  onComplete: () => void;
  onUndo: () => void;
  onCancel: () => void;
  canUndo: boolean;
  canComplete: boolean;
}

export const LineCollectionControls = ({
  onComplete,
  onUndo,
  onCancel,
  canUndo,
  canComplete
}: LineCollectionControlsProps) => {
  return (
    <View style={styles.lineControls}>
      {canComplete && (
        <TouchableOpacity 
          style={[styles.button, styles.controlButton]}
          onPress={onComplete}
        >
          <MaterialIcons name="check" size={24} color={Colors.BrightGreen} />
        </TouchableOpacity>
      )}
      
      {canUndo && (
        <TouchableOpacity 
          style={[styles.button, styles.controlButton]}
          onPress={onUndo}
        >
          <MaterialIcons 
            name="undo" 
            size={24} 
            color={Colors.Yellow}
          />
        </TouchableOpacity>
      )}
      
      <TouchableOpacity 
        style={[styles.button, styles.controlButton]}
        onPress={onCancel}
      >
        <MaterialIcons name="close" size={24} color={Colors.BrightRed} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  lineControls: {
    flexDirection: 'column',
    marginTop: 8,
  },
  button: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    margin: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  controlButton: {
    marginVertical: 4,
  }
}); 