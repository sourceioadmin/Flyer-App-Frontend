import axios from 'axios';

// Backend configuration
// Use relative URLs to leverage Vite proxy for development
const API_BASE_URL = '/api';
const BASE_URL = '';

// Debug logging
console.log('API Configuration:', {
  API_BASE_URL,
  currentHostname: window.location.hostname
});

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
};

export const companyAPI = {
  getAll: () => api.get('/company'),
  getById: (id) => api.get(`/company/${id}`),
  create: (companyData) => api.post('/company', companyData),
  update: (id, companyData) => api.put(`/company/${id}`, companyData),
  delete: (id) => api.delete(`/company/${id}`),
};

export const flyerAPI = {
  getAll: (params) => api.get('/flyer', { params }),
  uploadFlyer: (formData) => api.post('/flyer/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateFlyer: (id, formData) => api.put(`/flyer/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getFlyersByCompany: (companyId, year, month) => {
    const params = {};
    if (year && month) {
      params.year = year;
      params.month = month;
    }
    return api.get(`/flyer/company/${companyId}`, { params });
  },
  downloadFlyer: (flyerId) => `${API_BASE_URL}/flyer/download/${flyerId}`,
  getFlyerImageUrl: (imagePath) => {
    // Return the image path directly - Vite proxy handles /uploads routing to backend
    if (imagePath && imagePath.startsWith('/uploads/')) {
      return imagePath; // This will be proxied by Vite to the backend
    }
    return imagePath;
  },
  deleteFlyer: (flyerId) => api.delete(`/flyer/${flyerId}`),
};

export default api;
