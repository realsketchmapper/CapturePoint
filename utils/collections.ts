import { Position } from "@/types/collection.types";
import { v4 as uuidv4 } from 'uuid';

export const isValidPosition = (position: Position): position is [number, number] => {
  return Array.isArray(position) && 
         position.length === 2 &&
         typeof position[0] === 'number' && 
         typeof position[1] === 'number' &&
         !isNaN(position[0]) && 
         !isNaN(position[1]);
};

export const generateId = () => {
  return uuidv4();
};

export const generateClientId = () => {
  // Generate a shorter unique ID for client_id (20 chars max)
  return uuidv4().replace(/-/g, '').substring(0, 20);
};