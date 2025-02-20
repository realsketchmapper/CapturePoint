export interface LinePreviewState {
    isCollecting: boolean;
    collectedPoints: [number, number][];
    previewLineId: string | null;
    lastPointId: string | null;
  }
  
  export interface LinePreviewContextType {
    startCollection: () => void;
    updatePreview: (currentPosition: [number, number]) => void;
    collectPoint: (coordinates: [number, number]) => string;
    finishCollection: () => string | null;
    isCollecting: boolean;
    collectedPoints: [number, number][];
  }