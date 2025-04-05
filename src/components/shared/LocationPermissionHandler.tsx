import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocationContext } from '@/src/contexts/LocationContext';

export const LocationPermissionHandler: React.FC = () => {
  const { requestLocationPermission, currentLocation, isInitialized } = useLocationContext();

  const handleRequestPermission = async () => {
    await requestLocationPermission();
  };

  if (isInitialized && !currentLocation) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Location Access Required</Text>
        <Text style={styles.description}>
          This app needs access to your location to provide accurate positioning.
          Your location will be used until you connect to an NMEA device.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleRequestPermission}>
          <Text style={styles.buttonText}>Allow Location Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '50%',
    left: '10%',
    right: '10%',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 