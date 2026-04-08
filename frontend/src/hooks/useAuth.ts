import { useState, useEffect } from 'react';
import { getMe, getToken } from '../api/auth';
import type { User } from '../api/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => setError('Failed to load user'))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading, error, setUser };
}
