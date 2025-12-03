import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const response = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Products API
export const productsAPI = {
  getAll: async () => {
    const response = await api.get('/products');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },
  getByBarcode: async (codigo) => {
    const response = await api.get(`/products/barcode/${codigo}`);
    return response.data;
  },
  create: async (product) => {
    const response = await api.post('/products', product);
    return response.data;
  },
  update: async (id, product) => {
    const response = await api.put(`/products/${id}`, product);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },
};

// Customers API
export const customersAPI = {
  getAll: async () => {
    const response = await api.get('/customers');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },
  create: async (customer) => {
    const response = await api.post('/customers', customer);
    return response.data;
  },
  update: async (id, customer) => {
    const response = await api.put(`/customers/${id}`, customer);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },
};

// Sales API
export const salesAPI = {
  getAll: async () => {
    const response = await api.get('/sales');
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/sales/${id}`);
    return response.data;
  },
  create: async (sale) => {
    const response = await api.post('/sales', sale);
    return response.data;
  },
};

// Payment Plans API
export const paymentPlansAPI = {
  getAll: async () => {
    const response = await api.get('/payment-plans');
    return response.data;
  },
  create: async (plan) => {
    const response = await api.post('/payment-plans', plan);
    return response.data;
  },
};

// Goals API
export const goalsAPI = {
  getAll: async () => {
    const response = await api.get('/goals');
    return response.data;
  },
  getByPeriod: async (vendedor, mes, ano) => {
    const response = await api.get(`/goals/${vendedor}/${mes}/${ano}`);
    return response.data;
  },
  create: async (goal) => {
    const response = await api.post('/goals', goal);
    return response.data;
  },
};

// Reports API
export const reportsAPI = {
  getDashboard: async () => {
    const response = await api.get('/reports/dashboard');
    return response.data;
  },
  getSalesByVendor: async (mes, ano) => {
    const params = {};
    if (mes) params.mes = mes;
    if (ano) params.ano = ano;
    const response = await api.get('/reports/sales-by-vendor', { params });
    return response.data;
  },
  getInventoryValue: async () => {
    const response = await api.get('/reports/inventory-value');
    return response.data;
  },
};

export default api;
