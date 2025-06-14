import axios from 'axios';
import { API_ENDPOINTS } from './endpoints';
import { tokenStorage } from '../services/auth/tokenStorage';

console.log('Clients.ts loaded');

// Helper function to replace placeholders in URL
const replaceUrlPlaceholders = (url: string, params: Record<string, any>): string => {
  let result = url;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`:${key}`, String(value));
  }
  return result;
};

const api = axios.create({
  baseURL: API_ENDPOINTS.BASE_URL,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 10000 // Add a reasonable timeout
});

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    try {
      // Use tokenStorage instead of direct AsyncStorage access
      const credentials = await tokenStorage.getStoredCredentials();
      if (credentials?.token) {
        config.headers.Authorization = `Bearer ${credentials.token}`;
      }

      // Replace placeholders in URL if they exist
      if (config.url) {
        config.url = replaceUrlPlaceholders(config.url, config.params || {});
      }
    } catch (error) {
      console.error('Error retrieving token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Only check for success field if it exists, otherwise just return the response
    if (response.data && 'success' in response.data && !response.data.success) {
      throw new Error(response.data.error || 'API request failed');
    }
    return response;
  },
  (error) => {
    // Better error logging with more details
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error - Response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error('API Error - No Response:', error.request);
    } else {
      // Something happened in setting up the request that triggered an error
      console.error('API Error - Request setup:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export { api }; 