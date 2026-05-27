import { useCallback, useEffect, useState } from 'react';

import { toApiError } from '../api/client';

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function useAsyncResource<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const data = await loader();
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      const message = toApiError(error).message;
      setState((current) => ({ ...current, loading: false, error: message }));
      return null;
    }
  }, [loader]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
