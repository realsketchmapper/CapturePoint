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