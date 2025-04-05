import { GGAData, GSTData } from "@/types/nmea.types";

/**
 * Utility class for parsing NMEA sentences
 * Provides methods to parse GGA (Global Positioning System Fix Data) and GST (GNSS Pseudorange Error Statistics) sentences
 */
export class NMEAParser {
  /**
   * Parses a GGA sentence into a structured object
   * @param nmeaString - The NMEA GGA sentence to parse
   * @returns A GGAData object or null if the sentence is invalid
   */
  static parseGGA(nmeaString: string): GGAData | null {
    // Validate the sentence format
    if (!nmeaString.startsWith('$GPGGA') && !nmeaString.startsWith('$GNGGA')) {
      return null;
    }

    const parts = nmeaString.split(',');
    if (parts.length < 15) return null;

    // Convert DDMM.MMMMM to decimal degrees
    const convertCoordinate = (coord: string, direction: string, isLongitude: boolean): number | null => {
      if (!coord || !direction) return null;
      
      // Get degrees length based on whether it's longitude or latitude
      const degreeLength = isLongitude ? 3 : 2;
      const degrees = parseInt(coord.substring(0, degreeLength));
      const minutes = parseFloat(coord.substring(degreeLength));
      let decimal = degrees + (minutes / 60);
      
      if (direction === 'S' || direction === 'W') {
        decimal = -decimal;
      }
      
      return decimal;
    };

    return {
      time: parts[1],
      latitude: convertCoordinate(parts[2], parts[3], false),  // false for latitude
      longitude: convertCoordinate(parts[4], parts[5], true),  // true for longitude
      quality: parseInt(parts[6]) || 0,
      satellites: parseInt(parts[7]) || 0,
      hdop: parseFloat(parts[8]) || 0,
      altitude: parseFloat(parts[9]) || 0,
      altitudeUnit: parts[10],
      geoidHeight: parseFloat(parts[11]) || 0,
      geoidHeightUnit: parts[12]
    };
  }

  /**
   * Parses a GST sentence into a structured object
   * @param nmeaString - The NMEA GST sentence to parse
   * @returns A GSTData object or null if the sentence is invalid
   */
  static parseGST(nmeaString: string): GSTData | null {
    // Verify if it's a GST string
    if (!nmeaString.startsWith('$GPGST') && !nmeaString.startsWith('$GNGST')) {
      return null;
    }

    const parts = nmeaString.split(',');
    if (parts.length < 9) return null;

    return {
      time: parts[1],
      rmsTotal: parseFloat(parts[2]) || 0,
      semiMajor: parseFloat(parts[3]) || 0,
      semiMinor: parseFloat(parts[4]) || 0,
      orientation: parseFloat(parts[5]) || 0,
      latitudeError: parseFloat(parts[6]) || 0,
      longitudeError: parseFloat(parts[7]) || 0,
      heightError: parseFloat(parts[8]) || 0
    };
  }

  /**
   * Calculates the horizontal RMS (Root Mean Square) error from GST data
   * @param gstData - The GST data containing error information
   * @returns The horizontal RMS error in meters
   */
  static calculateHorizontalRMS(gstData: GSTData): number {
    return Math.sqrt(
      Math.pow(gstData.latitudeError, 2) + 
      Math.pow(gstData.longitudeError, 2)
    );
  }

  /**
   * Gets the vertical RMS error from GST data
   * @param gstData - The GST data containing error information
   * @returns The vertical RMS error in meters
   */
  static getVerticalRMS(gstData: GSTData): number {
    return gstData.heightError;
  }

  /**
   * Converts GGA data to Maplibre coordinates format
   * @param ggaData - The GGA data to convert
   * @returns An array of [longitude, latitude] or null if the data is invalid
   */
  static ggaToMaplibreCoordinates(ggaData: GGAData): [number, number] | null {
    if (ggaData.longitude === null || ggaData.latitude === null) {
      return null;
    }
    return [ggaData.longitude, ggaData.latitude];
  }

  /**
   * Converts GGA data to MySQL POINT format
   * @param ggaData - The GGA data to convert
   * @returns An object with longitude and latitude or null if the data is invalid
   */
  static ggaToMySQLPoint(ggaData: GGAData): { longitude: number; latitude: number } | null {
    if (ggaData.longitude === null || ggaData.latitude === null) {
      return null;
    }
    return { longitude: ggaData.longitude, latitude: ggaData.latitude };
  }
} 