import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
});

// Add auth token to requests
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
API.interceptors.response.use(
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

// ── Auth ──
export const register = (data) => API.post('/auth/register', data);
export const login = (data) => API.post('/auth/login', data);
export const getMe = () => API.get('/auth/me');

// ── Ideas ──
export const getAllIdeas = () => API.get('/ideas/');
export const getMyIdeas = () => API.get('/ideas/my-ideas');
export const getIdea = (id) => API.get(`/ideas/${id}`);
export const getRankings = () => API.get('/ideas/rankings');
export const checkDuplicate = (data) => API.post('/ideas/check-duplicate', data);

export const submitIdea = (formData) =>
  API.post('/ideas/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// ── Admin ──
export const approveIdea = (data) => API.post('/admin/approve', data);
export const rateIdea = (data) => API.post('/admin/rate', data);
export const getApprovals = (ideaId) => API.get(`/admin/approvals/${ideaId}`);
export const getRatings = (ideaId) => API.get(`/admin/ratings/${ideaId}`);
export const getAdminDashboard = () => API.get('/admin/dashboard');
export const getDetailedReport = () => API.get('/admin/reports/detailed');
export const sendDetailedReport = (data) => API.post('/admin/reports/send', data);
export const downloadDetailedReportPdf = () =>
  API.get('/admin/reports/detailed/pdf', { responseType: 'blob' });

// ── Email Recipients ──
export const addEmailRecipient = (data) => API.post('/admin/email-recipients', data);
export const getEmailRecipients = () => API.get('/admin/email-recipients');
export const removeEmailRecipient = (id) => API.delete(`/admin/email-recipients/${id}`);

// ── Super Admin ──
export const createAdmin = (data) => API.post('/superadmin/create-admin', data);
export const createUser = (data) => API.post('/superadmin/create-user', data);
export const removeAdmin = (id) => API.delete(`/superadmin/remove-admin/${id}`);
export const getAdmins = () => API.get('/superadmin/admins');
export const getAllUsers = () => API.get('/superadmin/users');
export const getAnalytics = () => API.get('/superadmin/analytics');

export default API;
