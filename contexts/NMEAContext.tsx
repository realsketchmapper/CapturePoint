import { NMEAContextType, GGAData, GSTData } from "@/types/nmea.types";
import { useCallback, useContext, useState, createContext } from "react";
import { BluetoothManager } from "@/services/bluetooth/bluetoothManager";
import { NMEAParser } from "@/services/gnss/nmeaParser";

const NMEAContext = createContext<NMEAContextType | null>(null);

export const NMEAProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [ggaData, setGGAData] = useState<GGAData | null>(null);
  const [gstData, setGSTData] = useState<GSTData | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNMEAData = useCallback((data: string) => {
    //console.log("NMEA RAW", data);
    const lines = data.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Parse GGA data
      const parsedGGA = NMEAParser.parseGGA(trimmedLine);
      if (parsedGGA) {
        // Convert altitude from meters to feet
        const convertedData = {
          ...parsedGGA,
          altitude: parsedGGA.altitude * 3.28084,
          geoidHeight: parsedGGA.geoidHeight * 3.28084
        };
        setGGAData(convertedData);
      }

      // Parse GST data
      const parsedGST = NMEAParser.parseGST(trimmedLine);
      if (parsedGST) {
        // Convert errors from meters to feet if needed
        const convertedGST = {
          ...parsedGST,
          heightError: parsedGST.heightError * 3.28084
        };
        setGSTData(convertedGST);
      }
    }
  }, []);

  const startListening = useCallback(async (address: string) => {
    try {
      setError(null);
      await BluetoothManager.startListeningToDevice(address, handleNMEAData);
      setIsListening(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start listening';
      setError(errorMessage);
    }
  }, [handleNMEAData]);

  const stopListening = useCallback(async (address: string) => {
    try {
      await BluetoothManager.stopListeningToDevice(address);
      setIsListening(false);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop listening';
      setError(errorMessage);
    }
  }, []);

  const value: NMEAContextType = {
    ggaData,
    gstData,
    isListening,
    startListening,
    stopListening,
    error
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