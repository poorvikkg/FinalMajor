import axios from 'axios';

// Create central Axios instance with common settings
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT token dynamically from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('surveillance_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor to handle common API errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If token is invalid or expired (401), automatically clear token and redirect to login
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('surveillance_token');
      // If we are not already on the login page, redirect
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
