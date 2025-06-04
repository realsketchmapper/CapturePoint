import { GGAData, GSTData, RTKProLocateData, RTKProGPSData, RTKProData } from "@/types/nmea.types";

/**
 * Utility class for parsing NMEA sentences and RTK-Pro data
 * Provides methods to parse GGA (Global Positioning System Fix Data) and GST (GNSS Pseudorange Error Statistics) sentences
 * Also provides methods to parse RTK-Pro specific LOC3 and TLT3 data formats
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
   * Parses RTK-Pro LOC3 locate data
   * Format: LOG,LOC3,750,22601181323,8192,0.00,-0.000,2,3,4,101,-0.04,0.271,1.40,0.08
   * @param dataString - The LOC3 data string to parse
   * @returns RTKProLocateData object or null if invalid
   */
  static parseRTKProLOC3(dataString: string): RTKProLocateData | null {
    if (!dataString.startsWith('LOG,LOC3,')) {
      return null;
    }

    const parts = dataString.split(',');
    if (parts.length < 15) return null;

    try {
      return {
        logNumber: parseInt(parts[2]) || 0,
        locatorSerialNumber: parts[3] || '',
        locateFrequency: parseFloat(parts[4]) || 0, // Hertz
        measuredDepthOfUtility: parseFloat(parts[5]) || 0, // Metres
        measuredLocateCurrent: parseFloat(parts[6]) || 0, // Amperes
        measuredLocateSignalDirection: parseFloat(parts[7]) || 0,
        locateView: parseInt(parts[8]) || 0,
        locateMode: parseInt(parts[9]) || 0,
        gain: parseFloat(parts[10]) || 0, // Decibel
        measuredVectorOffset: parseFloat(parts[11]) || 0, // Metres
        vectorSeparation: parseFloat(parts[12]) || 0, // Metres
        compassAngle: parseFloat(parts[13]) || 0, // Radians
        distanceFromLastLog: parseFloat(parts[14]) || 0 // Metres
      };
    } catch (error) {
      console.error('Error parsing RTK-Pro LOC3 data:', error);
      return null;
    }
  }

  /**
   * Parses RTK-Pro TLT3 GPS data
   * Format: LOG,TLT3,750,22601181323,013405.80,020625,3945.9475394,N,08617.1317687,W,5,32,1.00,0.51,0.86,245.12,-33.27,0.37,0.15,0.05
   * @param dataString - The TLT3 data string to parse
   * @returns RTKProGPSData object or null if invalid
   */
  static parseRTKProTLT3(dataString: string): RTKProGPSData | null {
    if (!dataString.startsWith('LOG,TLT3,')) {
      return null;
    }

    const parts = dataString.split(',');
    if (parts.length < 21) return null;

    try {
      // Convert coordinates to decimal degrees
      const latDeg = Math.floor(parseFloat(parts[6]) / 100);
      const latMin = parseFloat(parts[6]) % 100;
      const latitude = latDeg + (latMin / 60);
      const finalLat = parts[7] === 'S' ? -latitude : latitude;

      const lonDeg = Math.floor(parseFloat(parts[8]) / 100);
      const lonMin = parseFloat(parts[8]) % 100;
      const longitude = lonDeg + (lonMin / 60);
      const finalLon = parts[9] === 'W' ? -longitude : longitude;

      return {
        logNumber: parseInt(parts[2]) || 0,
        locatorSerialNumber: parts[3] || '',
        timeUTC: parts[4] || '', // HHMMSS.SS format
        date: parts[5] || '', // DDMMYY format
        latitude: finalLat, // Decimal degrees
        longitude: finalLon, // Decimal degrees
        latitudeHemisphere: parts[7] || '',
        longitudeHemisphere: parts[9] || '',
        gpsFix: parseInt(parts[10]) || 0,
        numberSatellites: parseInt(parts[11]) || 0,
        positionalDilutionOfPrecision: parseFloat(parts[12]) || 0,
        horizontalDilutionOfPrecision: parseFloat(parts[13]) || 0,
        verticalDilutionOfPrecision: parseFloat(parts[14]) || 0,
        altitudeGeoid: parseFloat(parts[15]) || 0, // Metres
        geoidSeparation: parseFloat(parts[16]) || 0, // Metres
        standardDeviationLatitude: parseFloat(parts[17]) || 0, // Metres
        standardDeviationLongitude: parseFloat(parts[18]) || 0, // Metres
        standardDeviationAltitude: parseFloat(parts[19]) || 0 // Metres
      };
    } catch (error) {
      console.error('Error parsing RTK-Pro TLT3 data:', error);
      return null;
    }
  }

  /**
   * Parses RTK-Pro data and combines LOC3 and TLT3 information
   * @param dataString - The RTK-Pro data string to parse
   * @returns RTKProData object or null if invalid
   */
  static parseRTKProData(dataString: string): RTKProData | null {
    const timestamp = new Date().toISOString();
    
    // Try to parse as LOC3 data
    const locateData = this.parseRTKProLOC3(dataString);
    if (locateData) {
      return {
        locateData,
        timestamp
      };
    }

    // Try to parse as TLT3 data
    const gpsData = this.parseRTKProTLT3(dataString);
    if (gpsData) {
      return {
        gpsData,
        timestamp
      };
    }

    return null;
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

  /**
   * Converts RTK-Pro GPS data to Maplibre coordinates format
   * @param rtkProGpsData - The RTK-Pro GPS data to convert
   * @returns An array of [longitude, latitude] or null if the data is invalid
   */
  static rtkProGpsToMaplibreCoordinates(rtkProGpsData: RTKProGPSData): [number, number] | null {
    if (!rtkProGpsData.longitude || !rtkProGpsData.latitude) {
      return null;
    }
    return [rtkProGpsData.longitude, rtkProGpsData.latitude];
  }
} 