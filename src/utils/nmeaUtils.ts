import { NMEA_QUALITY_TYPES } from '@/src/types/nmea.types';

/**
 * Returns a human-readable text description of the NMEA fix quality
 * @param quality The NMEA fix quality number
 * @returns A string description of the fix quality
 */
export const getFixQualityText = (quality: number): string => {
  return NMEA_QUALITY_TYPES[quality as keyof typeof NMEA_QUALITY_TYPES] || `Unknown (${quality})`;
}; 