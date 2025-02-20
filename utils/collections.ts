import { Position } from "@/types/collection.types";

export const isValidPosition = (position: Position): position is { longitude: number; latitude: number } => {
  return typeof position.longitude === 'number' && 
         typeof position.latitude === 'number' &&
         !isNaN(position.longitude) && 
         !isNaN(position.latitude);
};