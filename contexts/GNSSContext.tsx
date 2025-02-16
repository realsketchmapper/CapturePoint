import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { Alert } from 'react-native';

interface GNSSContextType {
  currentNMEA: string | null;
  lastCollectedPoint: {
    latitude: number | null;
    longitude: number | null;
    timestamp: string | null;
    rawNMEA: string | null;
  };
  recentNMEAReadings: string[];
  collectionSettings: {
    useTimedCollection: boolean;
    collectionDuration: number;
    useTilt: boolean;  // Add this
  };
  setCurrentNMEA: (nmea: string) => void;
  setCollectionSettings: (settings: { 
    useTimedCollection: boolean; 
    collectionDuration: number 
    useTilt: boolean;  // Add this
  }) => void;
  collectPoint: () => Promise<void>;
  logRawNMEA: () => void;
}

const GNSSContext = createContext<GNSSContextType | undefined>(undefined);
console.log('GNSSProvider mounting');

function GNSSProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      console.log('GNSSProvider unmounting');
    };
  }, []);

  const [nmeaState, setNmeaState] = useState<{
    current: string | null;
    recent: string[];
  }>({
    current: null,
    recent: [],
  });

  const [lastCollectedPoint, setLastCollectedPoint] = useState<{
    latitude: number | null;
    longitude: number | null;
    timestamp: string | null;
    rawNMEA: string | null;
  }>({
    latitude: null,
    longitude: null,
    timestamp: null,
    rawNMEA: null,
  });

  const [collectionSettings, setCollectionSettings] = useState({
    useTimedCollection: false,
    collectionDuration: 1,
    useTilt: false
  });

  const parseGNSSData = useCallback((nmeaString: string): { latitude: number | null; longitude: number | null } => {
    if (nmeaString.startsWith('@GEINS')) {
      const parts = nmeaString.split(',');
      if (parts.length > 3) {
        const lat = parseFloat(parts[2]);
        const lon = parseFloat(parts[3]);
        
        if (!isNaN(lat) && !isNaN(lon) && 
            lat >= -90 && lat <= 90 && 
            lon >= -180 && lon <= 180) {
          return { latitude: lat, longitude: lon };
        }
      }
    }
    
    if (nmeaString.includes('GGA')) {
      const sentences = nmeaString.split('\r\n');
      const ggaSentence = sentences.find(s => s.startsWith('$GPGGA') || s.startsWith('$GNGGA'));
      
      if (ggaSentence) {
        const parts = ggaSentence.split(',');
        if (parts.length >= 6) {
          try {
            const rawLat = parts[2];
            const latDir = parts[3];
            const rawLon = parts[4];
            const lonDir = parts[5];

            const latDeg = parseFloat(rawLat.substring(0, 2));
            const latMin = parseFloat(rawLat.substring(2));
            const lonDeg = parseFloat(rawLon.substring(0, 3));
            const lonMin = parseFloat(rawLon.substring(3));
            
            let latitude = latDeg + (latMin / 60);
            let longitude = lonDeg + (lonMin / 60);
            
            if (latDir === 'S') latitude *= -1;
            if (lonDir === 'W') longitude *= -1;

            return { latitude, longitude };
          } catch (error) {
            return { latitude: null, longitude: null };
          }
        }
      }
    }

    return { latitude: null, longitude: null };
  }, []);

  const handleSetCurrentNMEA = useCallback((nmea: string) => {
    setNmeaState(prev => ({
      current: nmea,
      recent: [...prev.recent, nmea].slice(-10)
    }));
  }, []);

  const instantCollection = useCallback(() => {
    const validReading = [...nmeaState.recent].reverse().reduce((acc, nmea) => {
      if (acc) return acc;
      const parsed = parseGNSSData(nmea);
      return parsed.latitude !== null && parsed.longitude !== null ? { nmea, parsed } : null;
    }, null as { nmea: string, parsed: ReturnType<typeof parseGNSSData> } | null);

    if (!validReading || validReading.parsed.latitude === null || validReading.parsed.longitude === null) return false;

    setLastCollectedPoint({
      latitude: validReading.parsed.latitude,
      longitude: validReading.parsed.longitude,
      timestamp: new Date().toISOString(),
      rawNMEA: validReading.nmea
    });

    Alert.alert(
      'Success',
      `Point collected at\nLatitude: ${validReading.parsed.latitude.toFixed(6)}\nLongitude: ${validReading.parsed.longitude.toFixed(6)}`
    );
    return true;
  }, [nmeaState.recent, parseGNSSData]);

  const timedCollection = useCallback(async (): Promise<boolean> => {
    const points: { latitude: number; longitude: number }[] = [];
    const duration = collectionSettings.collectionDuration * 1000;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const collectInterval = setInterval(() => {
        if (Date.now() - startTime >= duration) {
          clearInterval(collectInterval);
          
          if (points.length === 0) {
            Alert.alert('Error', 'No valid points collected during timed collection');
            resolve(false);
            return;
          }

          const avgLat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
          const avgLon = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;

          setLastCollectedPoint({
            latitude: avgLat,
            longitude: avgLon,
            timestamp: new Date().toISOString(),
            rawNMEA: nmeaState.recent[nmeaState.recent.length - 1]
          });

          Alert.alert('Success',
            `Averaged point collected\nLatitude: ${avgLat.toFixed(6)}\nLongitude: ${avgLon.toFixed(6)}\nSamples: ${points.length}`
          );
          resolve(true);
        } else {
          const lastNMEA = nmeaState.recent[nmeaState.recent.length - 1];
          if (lastNMEA) {
            const parsed = parseGNSSData(lastNMEA);
            if (parsed.latitude !== null && parsed.longitude !== null) {
              points.push({
                latitude: parsed.latitude,
                longitude: parsed.longitude
              });
            }
          }
        }
      }, 100);
    });
  }, [collectionSettings.collectionDuration, nmeaState.recent, parseGNSSData]);

  const collectPoint = useCallback(async () => {
    if (nmeaState.recent.length === 0) {
      Alert.alert('Error', 'No NMEA data available. Make sure your GNSS device is connected and sending data.');
      return;
    }

    if (collectionSettings.useTimedCollection) {
      await timedCollection();
    } else if (!instantCollection()) {
      Alert.alert('Error', 'Could not parse coordinates from GNSS data. Please try again.');
    }
  }, [nmeaState.recent.length, collectionSettings.useTimedCollection, timedCollection, instantCollection]);

  const logRawNMEA = useCallback(() => {
    let count = 0;
    console.log("=== Starting NMEA Log ===");
    const interval = setInterval(() => {
      if (count < 30 && nmeaState.current) {
        console.log(nmeaState.current);
        count++;
      } else {
        clearInterval(interval);
        console.log("=== End NMEA Log ===");
      }
    }, 100);
  }, [nmeaState.current]);

  const contextValue = useMemo(() => ({
    currentNMEA: nmeaState.current,
    lastCollectedPoint,
    setCurrentNMEA: handleSetCurrentNMEA,
    collectPoint,
    recentNMEAReadings: nmeaState.recent,
    collectionSettings,
    setCollectionSettings,
    logRawNMEA
  }), [nmeaState, lastCollectedPoint, handleSetCurrentNMEA, collectPoint, 
      collectionSettings, logRawNMEA]);

  return (
    <GNSSContext.Provider value={contextValue}>
      {children}
    </GNSSContext.Provider>
  );
}

function useGNSS() {
  const context = useContext(GNSSContext);
  if (context === undefined) {
    throw new Error('useGNSS must be used within a GNSSProvider');
  }
  return context;
}

export { GNSSProvider, useGNSS };