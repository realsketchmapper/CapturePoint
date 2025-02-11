export interface ApiResponse<T> {
    success: boolean;
    error?: string;
    projects?: T;
    // Add other potential response fields here
  }
  
  export interface ApiError {
    message: string;
    code?: string;
    status?: number;
  }