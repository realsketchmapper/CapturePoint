export interface ApiResponse<T> {
    success: boolean;
    error?: string;
    projects?: T;
  }
  
  export interface ApiError {
    message: string;
    code?: string;
    status?: number;
  }