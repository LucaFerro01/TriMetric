import { useState, useEffect } from 'react';
import { getMe, getToken } from '../api/auth';
import type { User } from '../api/auth';

export function useAuth() {
  const token = getToken();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getMe()
      .then(setUser)
      .catch(() => setError('Failed to load user'))
      .finally(() => setLoading(false));
  }, [token]);

  return { user, loading, error, setUser };
}
