import axios from 'axios';

// Backend configuration
// Use environment variable for production, fallback to proxy for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Safety check (helps during debugging)
if (!API_BASE_URL) {
  console.error('VITE_API_BASE_URL is not defined');
}

// Debug logging
console.log('API Configuration:', {
  API_BASE_URL,
  mode: import.meta.env.MODE,
  hostname: window.location.hostname,
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
  downloadFlyer: (flyerId) =>
    api.get(`/flyer/download/${flyerId}`, { responseType: 'blob' }),
  getFlyerImageUrl: (imagePath) => imagePath,
  deleteFlyer: (flyerId) => api.delete(`/flyer/${flyerId}`),
};

export default api;
