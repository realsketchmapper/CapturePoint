import axios from 'axios';
import { API_ENDPOINTS } from './endpoints';
import { tokenStorage } from '@/services/auth/tokenStorage';

const api = axios.create({
  baseURL: API_ENDPOINTS.BASE_URL + '/',
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
    // Only check for success field if response.data is an object
    if (response.data && typeof response.data === 'object' && 'success' in response.data && !response.data.success) {
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
);export { api };

