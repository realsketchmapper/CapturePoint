import { GGAData, GSTData } from "@/types/nmea.types";

export class NMEAParser {
  static parseGGA(nmeaString: string): GGAData | null {
    // Your existing GGA parsing code remains the same
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

  // Helper method to calculate horizontal RMS from GST data
  static calculateHorizontalRMS(gstData: GSTData): number {
    return Math.sqrt(
      Math.pow(gstData.latitudeError, 2) + 
      Math.pow(gstData.longitudeError, 2)
    );
  }

  // Helper method to get vertical RMS (same as height error in GST)
  static getVerticalRMS(gstData: GSTData): number {
    return gstData.heightError;
  }
}