import axios from "axios";

// Backend configuration
// Use environment variable for production, fallback to auto-detect for development
let API_BASE_URL;

if (import.meta.env.VITE_API_BASE_URL) {
  // Use environment variable if set
  API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
} else {
  // Auto-detect based on hostname
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  if (isLocalhost) {
    // On localhost, use proxy
    API_BASE_URL = "/api";
  } else {
    // On network IP (e.g., 10.10.10.68), connect directly to backend
    const protocol = window.location.protocol; // Use same protocol (https)
    API_BASE_URL = `${protocol}//${hostname}:5001/api`;
  }
}

// Debug logging
console.log("API Configuration:", {
  API_BASE_URL,
  mode: import.meta.env.MODE,
  hostname: window.location.hostname,
  protocol: window.location.protocol,
});

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const authAPI = {
  login: (email, password) => api.post("/Auth/login", { email, password }),
  register: (userData) => api.post("/Auth/register", userData),
};

export const companyAPI = {
  getAll: () => api.get("/company"),
  getById: (id) => api.get(`/company/${id}`),
  create: (companyData) => api.post("/company", companyData),
  update: (id, companyData) => api.put(`/company/${id}`, companyData),
  delete: (id) => api.delete(`/company/${id}`),
};

export const flyerAPI = {
  getAll: (params) => api.get("/flyer", { params }),
  uploadFlyer: (formData) =>
    api.post("/flyer/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  updateFlyer: (id, formData) =>
    api.put(`/flyer/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
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
    api.get(`/flyer/download/${flyerId}`, { responseType: "blob" }),
  getFlyerImageUrl: (imagePath) => imagePath,
  deleteFlyer: (flyerId) => api.delete(`/flyer/${flyerId}`),
};

export const reviewAPI = {
  addCustomer: (data) => api.post("/review/customer", data),
  getCustomersByCompany: (companyId) =>
    api.get(`/review/customers/${companyId}`),
  getCustomer: (id) => api.get(`/review/customer/${id}`),
  deactivateCustomer: (id) => api.delete(`/review/customer/${id}`),
};

export default api;
