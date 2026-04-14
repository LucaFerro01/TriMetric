import client from './client';

export interface User {
  id: string;
  email: string;
  name?: string;
  weight?: number;
  height?: number;
  birthDate?: string;
  stravaId?: string;
  createdAt: string;
}

export async function getMe(): Promise<User> {
  const res = await client.get('/auth/me');
  return res.data;
}

export async function updateProfile(data: Partial<Pick<User, 'name' | 'weight' | 'height' | 'birthDate'>>): Promise<void> {
  await client.patch('/auth/profile', data);
}

export function getStravaAuthUrl(): string {
  const configuredApiUrl = import.meta.env.VITE_API_URL;
  const frontend = encodeURIComponent(window.location.origin);
  if (configuredApiUrl) return `${configuredApiUrl}/auth/strava?frontend=${frontend}`;

  // Default to backend port in local Docker setups to avoid SPA service-worker interception on /api routes.
  const host = window.location.hostname;
  const protocol = window.location.protocol;
  return `${protocol}//${host}:3001/auth/strava?frontend=${frontend}`;
}

export function saveToken(token: string): void {
  localStorage.setItem('trimetric_token', token);
}

export function getToken(): string | null {
  return localStorage.getItem('trimetric_token');
}

export function logout(): void {
  localStorage.removeItem('trimetric_token');
  window.location.href = '/login';
}
