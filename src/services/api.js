import axios from "axios";

// Backend configuration
// In dev mode, always use the Vite proxy (/api) — it works on localhost AND network IPs
// because Vite binds to 0.0.0.0. In production, use VITE_API_BASE_URL env variable.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

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
  deactivateCustomer: (id) => api.delete(`/review/customer/${id}`),
};

export const notificationAPI = {
  getByCompany: (companyId) => api.get(`/notification/${companyId}`),
  markRead: (id) => api.put(`/notification/${id}/read`),
  markAllRead: (companyId) => api.put(`/notification/read-all/${companyId}`),
};

export const pushAPI = {
  getVapidPublicKey: () => api.get("/push/vapid-public-key"),
  subscribe: (data) => api.post("/push/subscribe", data),
  unsubscribe: (data) => api.delete("/push/unsubscribe", { data }),
  send: (data) => api.post("/push/send", data),
};

export default api;
