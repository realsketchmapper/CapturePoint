/**
 * Type representing a project ID
 * Can be either a string or number, but should be treated as string for storage
 */
export type ProjectId = string | number;

/**
 * Converts a project ID to string format
 * Used for storage keys and consistent handling
 */
export function toProjectIdString(projectId: ProjectId): string {
  return String(projectId);
}

/**
 * Converts a project ID to number format
 * Used for API calls and internal calculations
 */
export function toProjectIdNumber(projectId: ProjectId): number {
  return Number(projectId);
}

/**
 * Checks if a project ID is valid
 */
export function isValidProjectId(projectId: ProjectId): boolean {
  const num = toProjectIdNumber(projectId);
  return !isNaN(num) && num > 0;
} 