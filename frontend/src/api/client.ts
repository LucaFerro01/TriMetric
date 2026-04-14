import axios from 'axios';

function resolveApiBaseUrl(): string {
  const configuredApiUrl = import.meta.env.VITE_API_URL;
  if (configuredApiUrl) return configuredApiUrl;

  const { hostname, port, protocol } = window.location;
  // In local mixed mode (frontend on :8080, backend via pnpm on :3001), bypass nginx /api proxy.
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '8080') {
    return `${protocol}//${hostname}:3001`;
  }

  return '/api';
}

const client = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('trimetric_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('trimetric_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
