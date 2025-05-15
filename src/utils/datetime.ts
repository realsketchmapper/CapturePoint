/**
 * Standardizes a datetime string to ISO format without timezone offset
 * @param date - Date string or Date object
 * @returns ISO string without timezone offset
 */
export function standardizeDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toISOString().split('.')[0] + 'Z';
}

/**
 * Gets the current time in standardized format
 * @returns Current time in standardized format
 */
export function getCurrentStandardizedTime(): string {
  return standardizeDateTime(new Date());
}

/**
 * Formats a UTC datetime string to display in the original collection timezone
 * @param utcTime - UTC ISO datetime string
 * @param collectionTimezone - The timezone in which the data was collected
 * @param formatOptions - Optional Intl.DateTimeFormatOptions
 * @returns Formatted date string in the original collection timezone
 */
export function displayInLocalTimezone(
  utcTime: string | Date | null | undefined, 
  collectionTimezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
  formatOptions: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: 'numeric', 
    minute: 'numeric',
    second: 'numeric',
    timeZoneName: 'short'
  }
): string {
  if (!utcTime) {
    return 'N/A';
  }
  
  try {
    return new Date(utcTime).toLocaleString('en-US', {
      ...formatOptions,
      timeZone: collectionTimezone
    });
  } catch (error) {
    console.warn('Error formatting date in timezone:', error);
    // Fallback to device timezone if there's an error
    return new Date(utcTime).toLocaleString('en-US', formatOptions);
  }
}

/**
 * Gets the device's current timezone
 * @returns The device's timezone identifier
 */
export function getCurrentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
} 