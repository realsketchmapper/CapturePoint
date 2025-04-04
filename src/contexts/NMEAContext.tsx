import { NMEAContextType, GGAData, GSTData } from "../types/nmea.types";
import { useCallback, useContext, useState, createContext } from "react";
import { BluetoothManager } from "../services/bluetooth/bluetoothManager";
import { NMEAParser } from "../services/gnss/nmeaParser";

// Define types for the coordinates in different formats
export type MaplibreCoordinates = [number, number]; // [longitude, latitude]
export type MySQLPoint = { longitude: number; latitude: number };

const NMEAContext = createContext<NMEAContextType | null>(null);

export const NMEAProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [ggaData, setGGAData] = useState<GGAData | null>(null);
  const [gstData, setGSTData] = useState<GSTData | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Process all NMEA sentences in a single pass
  const handleNMEAData = useCallback((data: string) => {
    const lines = data.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Try to parse as GGA
      const parsedGGA = NMEAParser.parseGGA(trimmedLine);
      if (parsedGGA) {
        setGGAData(parsedGGA);
      }

      // Try to parse as GST
      const parsedGST = NMEAParser.parseGST(trimmedLine);
      if (parsedGST) {
        setGSTData(parsedGST);
      }
    }
  }, []);

  // Helper function for error handling
  const handleError = useCallback((err: unknown, operation: string) => {
    const errorMessage = err instanceof Error ? err.message : `Failed to ${operation}`;
    setError(errorMessage);
  }, []);

  const startListening = useCallback(async (address: string) => {
    try {
      setError(null);
      await BluetoothManager.startListeningToDevice(address, handleNMEAData);
      setIsListening(true);
    } catch (err) {
      handleError(err, 'start listening');
    }
  }, [handleNMEAData, handleError]);

  const stopListening = useCallback(async (address: string) => {
    try {
      await BluetoothManager.stopListeningToDevice(address);
      setIsListening(false);
      setError(null);
    } catch (err) {
      handleError(err, 'stop listening');
    }
  }, [handleError]);

  // Helper functions to get coordinates in different formats
  const getMaplibreCoordinates = useCallback((): MaplibreCoordinates | null => {
    if (!ggaData || ggaData.latitude === null || ggaData.longitude === null) {
      return null;
    }
    return NMEAParser.ggaToMaplibreCoordinates(ggaData);
  }, [ggaData]);

  const getMySQLPoint = useCallback((): MySQLPoint | null => {
    if (!ggaData || ggaData.latitude === null || ggaData.longitude === null) {
      return null;
    }
    return NMEAParser.ggaToMySQLPoint(ggaData);
  }, [ggaData]);

  const value: NMEAContextType = {
    ggaData,
    gstData,
    isListening,
    startListening,
    stopListening,
    error,
    getMaplibreCoordinates,
    getMySQLPoint
  };

  return (
    <NMEAContext.Provider value={value}>
      {children}
    </NMEAContext.Provider>
  );
};

export const useNMEAContext = () => {
  const context = useContext(NMEAContext);
  if (context === null) {
    throw new Error('useNMEAContext must be used within a NMEAProvider');
  }
  return context;
}; 