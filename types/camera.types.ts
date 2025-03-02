

export interface CameraOptions {
  centerCoordinate: [number, number];
  zoomLevel?: number;
  animationDuration?: number;
}

export interface CameraBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}