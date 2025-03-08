import { Position } from "@/types/collection.types";

export const isValidPosition = (position: Position): position is { longitude: number; latitude: number } => {
  return typeof position.longitude === 'number' && 
         typeof position.latitude === 'number' &&
         !isNaN(position.longitude) && 
         !isNaN(position.latitude);
};

export const generateId = (): string => {
  const random = Math.random().toString(36).slice(2, 11);
  const timestamp = Date.now().toString(36);
  return `${random}-${timestamp}`;
};