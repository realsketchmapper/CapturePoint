import { AxiosRequestConfig } from 'axios';

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

export interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
  retry?: number;
  retryDelay?: number;
}