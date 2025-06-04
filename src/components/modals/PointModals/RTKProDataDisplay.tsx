import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';
import { RTKProLocateData, RTKProGPSData } from '@/types/nmea.types';

interface RTKProDataDisplayProps {
  locateData?: RTKProLocateData | null;
  gpsData?: RTKProGPSData | null;
}

const RTKProDataDisplay: React.FC<RTKProDataDisplayProps> = ({ locateData, gpsData }) => {
  // Helper function to format values
  const formatValue = (value: any, unit?: string): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
      return `${value.toFixed(3)}${unit ? ` ${unit}` : ''}`;
    }
    return String(value);
  };

  // Helper function to format angles from radians to degrees
  const formatAngle = (radians: number): string => {
    if (radians === null || radians === undefined) return 'N/A';
    const degrees = (radians * 180) / Math.PI;
    return `${degrees.toFixed(1)}° (${radians.toFixed(3)} rad)`;
  };

  // Helper function to format time
  const formatTime = (timeStr: string): string => {
    if (!timeStr || timeStr.length < 6) return timeStr;
    const hours = timeStr.substring(0, 2);
    const minutes = timeStr.substring(2, 4);
    const seconds = timeStr.substring(4);
    return `${hours}:${minutes}:${seconds} UTC`;
  };

  // Helper function to format date
  const formatDate = (dateStr: string): string => {
    if (!dateStr || dateStr.length < 6) return dateStr;
    const day = dateStr.substring(0, 2);
    const month = dateStr.substring(2, 4);
    const year = `20${dateStr.substring(4, 6)}`;
    return `${day}/${month}/${year}`;
  };

  if (!locateData && !gpsData) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* RTK-Pro Locate Data Section */}
      {locateData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RTK-Pro Locate Data</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Log Number:</Text>
            <Text style={styles.value}>{locateData.logNumber}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Serial Number:</Text>
            <Text style={styles.value}>{locateData.locatorSerialNumber}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Locate Frequency:</Text>
            <Text style={styles.value}>{formatValue(locateData.locateFrequency, 'Hz')}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Depth of Utility:</Text>
            <Text style={styles.value}>{formatValue(locateData.measuredDepthOfUtility, 'm')}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Locate Current:</Text>
            <Text style={styles.value}>{formatValue(locateData.measuredLocateCurrent, 'A')}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Signal Direction:</Text>
            <Text style={styles.value}>{formatValue(locateData.measuredLocateSignalDirection)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Locate View:</Text>
            <Text style={styles.value}>{formatValue(locateData.locateView)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Locate Mode:</Text>
            <Text style={styles.value}>{formatValue(locateData.locateMode)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Gain:</Text>
            <Text style={styles.value}>{formatValue(locateData.gain, 'dB')}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Vector Offset:</Text>
            <Text style={styles.value}>{formatValue(locateData.measuredVectorOffset, 'm')}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Vector Separation:</Text>
            <Text style={styles.value}>{formatValue(locateData.vectorSeparation, 'm')}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Compass Angle:</Text>
            <Text style={styles.value}>{formatAngle(locateData.compassAngle)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Distance from Last Log:</Text>
            <Text style={styles.value}>{formatValue(locateData.distanceFromLastLog, 'm')}</Text>
          </View>
        </View>
      )}

      {/* RTK-Pro GPS Data Section */}
      {gpsData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RTK-Pro GPS Data</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Log Number:</Text>
            <Text style={styles.value}>{gpsData.logNumber}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Serial Number:</Text>
            <Text style={styles.value}>{gpsData.locatorSerialNumber}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Time (UTC):</Text>
            <Text style={styles.value}>{formatTime(gpsData.timeUTC)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Date:</Text>
            <Text style={styles.value}>{formatDate(gpsData.date)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Latitude:</Text>
            <Text style={styles.value}>{formatValue(gpsData.latitude, '°')} {gpsData.latitudeHemisphere}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Longitude:</Text>
            <Text style={styles.value}>{formatValue(gpsData.longitude, '°')} {gpsData.longitudeHemisphere}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>GPS Fix Quality:</Text>
            <Text style={styles.value}>{gpsData.gpsFix} ({getFixQualityText(gpsData.gpsFix)})</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Number of Satellites:</Text>
            <Text style={styles.value}>{gpsData.numberSatellites}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>PDOP:</Text>
            <Text style={styles.value}>{formatValue(gpsData.positionalDilutionOfPrecision)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>HDOP:</Text>
            <Text style={styles.value}>{formatValue(gpsData.horizontalDilutionOfPrecision)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>VDOP:</Text>
            <Text style={styles.value}>{formatValue(gpsData.verticalDilutionOfPrecision)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Altitude (Geoid):</Text>
            <Text style={styles.value}>{formatValue(gpsData.altitudeGeoid, 'm')}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Geoid Separation:</Text>
            <Text style={styles.value}>{formatValue(gpsData.geoidSeparation, 'm')}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Std Dev Latitude:</Text>
            <Text style={styles.value}>{formatValue(gpsData.standardDeviationLatitude, 'm')}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Std Dev Longitude:</Text>
            <Text style={styles.value}>{formatValue(gpsData.standardDeviationLongitude, 'm')}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Std Dev Altitude:</Text>
            <Text style={styles.value}>{formatValue(gpsData.standardDeviationAltitude, 'm')}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

// Helper function to get fix quality text
const getFixQualityText = (quality: number): string => {
  switch (quality) {
    case 0: return 'Invalid';
    case 1: return 'GPS Fix';
    case 2: return 'DGPS Fix';
    case 3: return 'PPS Fix';
    case 4: return 'RTK Fixed';
    case 5: return 'RTK Float';
    case 6: return 'Estimated';
    case 7: return 'Manual';
    case 8: return 'Simulation';
    default: return 'Unknown';
  }
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.DarkBlue,
    marginBottom: 10,
    backgroundColor: Colors.LightBlue,
    padding: 8,
    borderRadius: 5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.VeryLightGrey,
  },
  label: {
    fontSize: 14,
    color: Colors.Grey,
    flex: 1,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: Colors.DarkBlue,
    flex: 2,
    textAlign: 'right',
    fontWeight: '600',
  },
});

export default RTKProDataDisplay; 