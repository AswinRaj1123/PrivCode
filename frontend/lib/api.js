import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Auth endpoints
  login: (username, password) =>
    apiClient.post('/login', { username, password }),
  
  getCurrentUser: () =>
    apiClient.get('/me'),
  
  // Query endpoint
  query: (question, repoPath) =>
    apiClient.post('/query', { question, repo_path: repoPath }),
  
  // Index endpoint
  index: (repoPath, indexPath) =>
    apiClient.post('/index', { repo_path: repoPath, index_path: indexPath }),
  
  // Health check
  health: () =>
    apiClient.get('/health'),
};

export default apiClient;
