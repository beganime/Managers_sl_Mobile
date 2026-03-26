import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../src/config/app';
import { AppUser, getCurrentUser } from '../src/api/mobile';
import { getJSON } from '../src/utils/storage';

export type CurrentUser = AppUser;

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const cached = await getJSON<CurrentUser | null>(STORAGE_KEYS.cachedProfile, null);
      if (cached) setUser(cached);

      const fresh = await getCurrentUser();
      setUser(fresh);
    } catch {
      // stay on cache
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { user, loading, reload };
}
