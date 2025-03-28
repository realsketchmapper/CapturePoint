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

// Validate if a string is a properly formatted client ID
export const isValidClientId = (id: string): boolean => {
  // Client IDs should be 20 characters long and contain only alphanumeric characters
  return /^[a-zA-Z0-9]{20}$/.test(id);
};

export const generateClientId = () => {
  // Generate a shorter unique ID for client_id (20 chars max)
  const id = uuidv4().replace(/-/g, '').substring(0, 20);
  
  // Validate the generated ID
  if (!isValidClientId(id)) {
    throw new Error('Generated client ID is invalid');
  }
  
  return id;
};